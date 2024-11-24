import streamDeck, { Action, action, DialAction, DidReceiveSettingsEvent, KeyAction, KeyDownEvent, PropertyInspector, SingletonAction, TitleOptions, WillAppearEvent } from "@elgato/streamdeck";
import { ChildProcess, exec, spawn } from "child_process";
import { Jimp, loadFont, HorizontalAlign, VerticalAlign, JimpMime } from "jimp";
import { Instance } from "../Instance";



/**
 * This is a singleton action so if more than one button gets it the states have to be tracked independently.
 */
@action({ UUID: "com.zaphop.quickalarm.set" })
export class QuickClock extends SingletonAction<Settings> {
		_instances: Instance[] = [];

	getInstance(action: Action) : Instance { 
		let currentInstance = this._instances.find(value => value.ActionId == action.id);
		if(currentInstance === undefined)
			throw new Error("Action instance not found. This should be impossible.")

		return currentInstance;
	}

	/**
	 * The {@link SingletonAction.onWillAppear} event is useful for setting the visual representation of an action when it becomes visible. This could be due to the Stream Deck first
	 * starting up, or the user navigating between pages / folders etc.. There is also an inverse of this event in the form of {@link streamDeck.client.onWillDisappear}.
	 */
	override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
		let currentInstance = this._instances.find(value => value.ActionId == ev.action.id);
		if(currentInstance === undefined)
		{
			// Capture the action so that we can use it to set the button's image from the animation timer.
			currentInstance = new Instance(ev.action, ev.payload.settings);
			this._instances.push(currentInstance);
		}

		// Update the settings on the instance
		currentInstance.Settings = ev.payload.settings;

		streamDeck.logger.info(import.meta.dirname);

		streamDeck.logger.info(JSON.stringify(ev));

		
		if(currentInstance.Settings.defaultsSet === undefined || currentInstance.Settings.defaultsSet === false) {
			const globalSettings = await streamDeck.settings.getGlobalSettings<Settings>();

			streamDeck.logger.info(JSON.stringify(globalSettings));

			if(globalSettings?.alarm !== undefined) {
				currentInstance.Settings.alarm = globalSettings?.alarm;
				streamDeck.logger.info("updated alarm to default: " + globalSettings?.alarm);
			}
			else {
				currentInstance.Settings.alarm = import.meta.dirname + "/../alarms/TimTaj_Go_Motivate_Yourself.mp3"
			}

			if(globalSettings?.hour !== undefined) {
				var hour = parseInt(globalSettings?.hour);
				hour++;
				
				if(hour > 24)
					hour = 1;

				currentInstance.Settings.hour = hour.toString();

				streamDeck.logger.info("updated hour to default: " + currentInstance.Settings.hour);
			}

			if(globalSettings?.increment !== undefined) {
				currentInstance.Settings.increment = globalSettings?.increment;
				streamDeck.logger.info("updated increment to default: " + currentInstance.Settings.increment );
			}

			if (globalSettings?.militaryTime !== undefined) {
				currentInstance.Settings.militaryTime = globalSettings?.militaryTime;
			}
			else {
				currentInstance.Settings.militaryTime = false;
			}

			currentInstance.Settings.defaultsSet = true;
			ev.action.setSettings(currentInstance.Settings);
			streamDeck.settings.setGlobalSettings(currentInstance.Settings);
		}

		await currentInstance.updateTimeDisplay();
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<Settings>): Promise<void> {
		let currentInstance = this.getInstance(ev.action);

		streamDeck.logger.info(`Settings updated: ${JSON.stringify(ev.payload.settings)}`);

		currentInstance.Settings = ev.payload.settings;

		// Keep the most recent settings that were saved so that the user doesn't have to 
		// reset the alarm sound.
		streamDeck.settings.setGlobalSettings(currentInstance.Settings);

		await ev.action.setSettings(currentInstance.Settings);

		await currentInstance.updateTimeDisplay();
	}

	/**
	 * Listens for the {@link SingletonAction.onKeyDown} event which is emitted by Stream Deck when an action is pressed. Stream Deck provides various events for tracking interaction
	 * with devices including key down/up, dial rotations, and device connectivity, etc. When triggered, {@link ev} object contains information about the event including any payloads
	 * and action information where applicable. In this example, our action will display a counter that increments by one each press. We track the current count on the action's persisted
	 * settings using `setSettings` and `getSettings`.
	 */
	override async onKeyDown(ev: KeyDownEvent<Settings>): Promise<void> {
		let currentInstance = this.getInstance(ev.action);
			
		currentInstance.Settings = ev.payload.settings;

		// If the player is playing, then reset everything.
		if (currentInstance.IsPlaying == true) {
			currentInstance.Settings.alarmOn = false;

			// Add 24 hours to the trigger time.
			let triggerTime = new Date(currentInstance.Settings.alarmTriggerTime);
			triggerTime.setTime(triggerTime.getTime() + 60 * 60 * 24 * 1000);
			currentInstance.Settings.alarmTriggerTime = triggerTime.getTime();

			await ev.action.setSettings(currentInstance.Settings);

			await currentInstance.stopPlaying();

			return;
		}

		if (currentInstance.Settings.alarm === undefined)
			currentInstance.Settings.alarmOn = false;

		if (currentInstance.Settings.alarmOn == true) {
			// Because the dropdown stores the value as string, we need to hack it into a number.
			currentInstance.Settings.minute += parseInt(currentInstance.Settings.increment.toString());

			if (currentInstance.Settings.minute >= 60) {
				currentInstance.Settings.minute = 0;
				currentInstance.Settings.alarmOn = false;
			}
			else {
				let nextAlarm = new Date();
				nextAlarm.setHours(parseInt(currentInstance.Settings.hour));
				nextAlarm.setMinutes(currentInstance.Settings.minute);
				nextAlarm.setSeconds(0);
				nextAlarm.setMilliseconds(0);

				if (nextAlarm.getTime() < new Date().getTime())
					nextAlarm.setTime(nextAlarm.getTime() + 60 * 60 * 24 * 1000);

				streamDeck.logger.info("Updating alarm: " + nextAlarm);
				currentInstance.Settings.alarmTriggerTime = nextAlarm.getTime();
			}
		}
		else {
			currentInstance.Settings.alarmOn = !currentInstance.Settings.alarmOn;

			if (currentInstance.Settings.minute === undefined)
				currentInstance.Settings.minute = 0;

			let nextAlarm = new Date();
			nextAlarm.setHours(parseInt(currentInstance.Settings.hour));
			nextAlarm.setMinutes(currentInstance.Settings.minute);
			nextAlarm.setSeconds(0);
			nextAlarm.setMilliseconds(0);

			if (nextAlarm.getTime() < new Date().getTime())
				nextAlarm.setTime(nextAlarm.getTime() + 60 * 60 * 24 * 1000);

			streamDeck.logger.info("Turning alarm on: " + nextAlarm);
			currentInstance.Settings.alarmTriggerTime = nextAlarm.getTime();
		}

		// Update the current count in the action's settings, and change the title.
		await ev.action.setSettings(currentInstance.Settings);

		await currentInstance.updateTimeDisplay();
	}
}