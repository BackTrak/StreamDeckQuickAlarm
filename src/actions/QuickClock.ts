import streamDeck, { action, DidReceiveSettingsEvent, KeyAction, KeyDownEvent, PropertyInspector, SingletonAction, TitleOptions, WillAppearEvent } from "@elgato/streamdeck";
import { ChildProcess, exec, spawn } from "child_process";
import { Jimp, loadFont, HorizontalAlign, VerticalAlign, JimpMime } from "jimp";
import { SANS_10_BLACK, SANS_16_BLACK, SANS_16_WHITE } from "jimp/fonts";



/**
 * An example action class that displays a count that increments by one each time the button is pressed.
 */
@action({ UUID: "com.zaphop.quickalarm.set" })
export class QuickClock extends SingletonAction<Settings> {
	_mediaPlayer: ChildProcess | undefined = undefined;
	_timer: NodeJS.Timeout | undefined = undefined;
	_settings : Settings | undefined = undefined;

	/**
	 * The {@link SingletonAction.onWillAppear} event is useful for setting the visual representation of an action when it becomes visible. This could be due to the Stream Deck first
	 * starting up, or the user navigating between pages / folders etc.. There is also an inverse of this event in the form of {@link streamDeck.client.onWillDisappear}. In this example,
	 * we're setting the title to the "count" that is incremented in {@link IncrementCounter.onKeyDown}.
	 */
	override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
		//return ev.action.setTitle(`${ev.payload.settings.count ?? 0}`);

		this._settings = ev.payload.settings;

		if (this._timer === undefined)
			this._timer = setInterval(() => { this.checkTimer(); }, 1000);

		await this.updateTimeDisplay(ev);

	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<Settings>): Promise<void> {
		//streamDeck.logger.info(ev);

		this._settings = ev.payload.settings;

		this._settings.alarmOn = false;

		await ev.action.setSettings(this._settings);

		await this.updateTimeDisplay(ev);
	}

	/**
	 * Listens for the {@link SingletonAction.onKeyDown} event which is emitted by Stream Deck when an action is pressed. Stream Deck provides various events for tracking interaction
	 * with devices including key down/up, dial rotations, and device connectivity, etc. When triggered, {@link ev} object contains information about the event including any payloads
	 * and action information where applicable. In this example, our action will display a counter that increments by one each press. We track the current count on the action's persisted
	 * settings using `setSettings` and `getSettings`.
	 */
	override async onKeyDown(ev: KeyDownEvent<Settings>): Promise<void> {
		this._settings = ev.payload.settings;

		// If the player is playing, then reset everything.
		if(this._mediaPlayer !== undefined)
		{
			this._settings.alarmOn = false;
			await ev.action.setSettings(this._settings);

			exec(`taskkill /PID ${this._mediaPlayer.pid} /F`);
			this._mediaPlayer = undefined;

			await this.updateTimeDisplay(ev);
			
			return;
		}

		if (this._settings.alarm === undefined)
			this._settings.alarmOn = false;

		if (this._settings.alarmOn == true) {
			let currentAlarm = new Date(this._settings.alarmTriggerTime);
			currentAlarm.setMinutes(currentAlarm.getMinutes() + parseInt(this._settings.increment.toString()));

			this._settings.alarmTriggerTime = currentAlarm.getTime();

			if (currentAlarm.getHours() != this._settings.hour)
				this._settings.alarmOn = false;
		}
		else {
			this._settings.alarmOn = !this._settings.alarmOn;
			let nextAlarm = new Date();
			nextAlarm.setHours(this._settings.hour);
			nextAlarm.setMinutes(0);
			nextAlarm.setSeconds(0);
			nextAlarm.setMilliseconds(0);

			if (nextAlarm.getTime() < new Date().getTime())
				nextAlarm.setTime(nextAlarm.getTime() + 60 * 60 * 24 * 1000);

			this._settings.alarmTriggerTime = nextAlarm.getTime();
		}

		// settings.incrementBy ??= 1;
		// settings.count = (settings.count ?? 0) + settings.incrementBy;

		// Update the current count in the action's settings, and change the title.
		await ev.action.setSettings(this._settings);



		// if (this._mediaPlayer !== undefined) {
		// 	exec(`taskkill /PID ${this._mediaPlayer.pid} /F`);
		// 	this._mediaPlayer = undefined;
		// }
		// else {
		// 	this._mediaPlayer = spawn("powershell", ["-ExecutionPolicy", "Bypass", "-File", "sounds/PlaySound.ps1", ev.payload.settings.alarm],
		// 		{
		// 			shell: false
		// 		});
		// }

		await this.updateTimeDisplay(ev);
	}

	checkTimer() : void {
		if(this._settings?.alarmOn == true)
		{
			let triggerTime = new Date(this._settings.alarmTriggerTime);

			if(triggerTime < new Date())
			{
				// Add 24 hours to the trigger time.
				triggerTime.setTime(triggerTime.getTime() +  + 60 * 60 * 24 * 1000);
				this._settings.alarmTriggerTime = triggerTime.getTime();

				this._mediaPlayer = spawn("powershell", ["-ExecutionPolicy", "Bypass", "-File", "sounds/PlaySound.ps1", this._settings.alarm],
				{
					shell: false
				});
			}
		}
	}

	async updateTimeDisplay(ev: WillAppearEvent<Settings> | DidReceiveSettingsEvent<Settings> | KeyDownEvent<Settings>): Promise<void> {
		const { settings } = ev.payload;

		let hour = ev.payload.settings.hour;
		let minutes = "00";

		if (settings.alarmOn == true) {
			const triggerTime = new Date(settings.alarmTriggerTime);
			hour = triggerTime.getHours();
			minutes = triggerTime.getMinutes().toString();
			if (minutes.length < 2)
				minutes = "0" + minutes;
		}

		let ampm = "am";
		if (hour > 11 && hour < 24)
			ampm = "pm";

		if (hour > 12)
			hour -= 12;

		let image = await this.createTextImage(`${hour}:${minutes} ${ampm}`, ev.payload.settings.alarmOn);

		await ev.action.setImage(image);
	}

	// Function to create an image with text and return it as a base64 string
	async createTextImage(text: string, alarmOn: boolean, width = 72, height = 72) {
		// Create a blank image
		const image = new Jimp({ width: width, height: height, color: '#00000000' });

		const background = await Jimp.read('imgs/quickclock/alarm-clock-key.png');

		image.blit(background);



		const font = await loadFont('fonts/arial-black/arial-black-20-bold.fnt');

		const offsets = [
			{ x: 1, y: 0 },
			{ x: 1, y: 1 },
			{ x: 1, y: -1 },
			{ x: 0, y: 1 },
			{ x: 0, y: -1 },
			{ x: -1, y: 0 },
			{ x: -1, y: 1 },
			{ x: -1, y: -1 },
		];

		const scale = 1.3;
		const scaleWidth = Math.round(width * scale);
		const scaleHeight = Math.round(height * scale);
		const outlineImage = new Jimp({ width: scaleWidth, height: scaleHeight, color: '#00000000' });

		// outline the image
		offsets.forEach(value => {
			outlineImage.print({
				font: font,
				x: value.x,
				y: value.y,
				text: {
					text: text,
					alignmentX: HorizontalAlign.CENTER,
					alignmentY: VerticalAlign.MIDDLE
				},
				maxWidth: scaleWidth,
				maxHeight: scaleHeight
			}
			);

			// https://github.com/jimp-dev/jimp/issues/537
			outlineImage.color([{ apply: 'xor', params: [{ r: 0x00, g: 0x00, b: 0x00 }] }]);
		});

		const fontImage = new Jimp({ width: scaleWidth, height: scaleHeight, color: '#00000000' });

		// Add text to the image
		fontImage.print({
			font: font,
			x: 0,
			y: 0,
			text: {
				text: text,
				alignmentX: HorizontalAlign.CENTER,
				alignmentY: VerticalAlign.MIDDLE
			},
			maxWidth: scaleWidth,
			maxHeight: scaleHeight
		}
		);

		let fontColor = { r: 0xff, g: 0x00, b: 0x00 };
		if (alarmOn == true)
			fontColor = { r: 0x00, g: 0xff, b: 0x00 };

		// https://github.com/jimp-dev/jimp/issues/537
		fontImage.color([{ apply: 'xor', params: [fontColor] }]);

		outlineImage.resize({ w: width, h: height });
		fontImage.resize({ w: width, h: height });

		image.blit(outlineImage);

		image.blit(fontImage);

		// Get the base64 string of the image
		const base64Image = await image.getBase64(JimpMime.png);
		return base64Image;
		//return base64Image.replace(/^data:image\/png;base64,/, ''); // Strip the data URL prefix
	}
}

/**
 * Settings for {@link IncrementCounter}.
 */
type Settings = {
	hour: number;
	increment: number;
	alarm: string; // The audio file to play
	alarmOn: boolean;
	alarmTriggerTime: number;
};
