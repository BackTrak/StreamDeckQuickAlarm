import streamDeck, { Action, action, DialAction, DidReceiveSettingsEvent, KeyAction, KeyDownEvent, PropertyInspector, SingletonAction, TitleOptions, WillAppearEvent } from "@elgato/streamdeck";
import { ChildProcess, exec, spawn } from "child_process";
import { Jimp, loadFont, HorizontalAlign, VerticalAlign, JimpMime, BmpColor } from "jimp";
import { SANS_10_BLACK, SANS_16_BLACK, SANS_16_WHITE } from "jimp/fonts";
import WebSocket from 'ws';

type SetImageDelegate = (image: string) => Promise<void>;
type SetSettings = (settings: Settings) => Promise<void>;
type Color = { r: number, g: number, b: number };

type RegisterEvent = {
	event: string; // -registerEvent parameter
	uuid: string; // -pluginUUID parameter
};

/**
 * An example action class that displays a count that increments by one each time the button is pressed.
 */
@action({ UUID: "com.zaphop.quickalarm.set" })
export class QuickClock extends SingletonAction<Settings> {
	_clockColorBase: Color = { r: 0x4c, g: 0x4c, b: 0x4c };
	_clockColorFlash: Color = { r: 0xde, g: 0xe2, b: 0x00 };

	_mediaPlayer: ChildProcess | undefined = undefined;
	_timer: NodeJS.Timeout | undefined = undefined;
	_settings: Settings | undefined = undefined;
	_animationTimer: NodeJS.Timeout | undefined = undefined;

	_clockColor: Color = { r: 0x2c, g: 0x2c, b: 0x2c };

	//_setImage: SetImageDelegate | undefined = undefined;
	_action: DialAction | KeyAction | undefined = undefined;

	_animationPosition = 0;
	readonly _frameCount = 25;


	// A plugin can't also hit the websocket directly :(

	// _port: number;
	// _pluginUUID: string;
	// _registerEvent: string;

	// _ws: WebSocket;

	// constructor(port: number, pluginUUID: string, registerEvent: string) {
	// 	super();

	// 	this._port = port;
	// 	this._pluginUUID = pluginUUID;
	// 	this._registerEvent = registerEvent;

	// 	const event: RegisterEvent = {event: registerEvent, uuid: pluginUUID};

	// 	this._ws = new WebSocket("ws://localhost:" + port.toString())
	// 	this._ws.on('open', () => {
	// 		streamDeck.logger.info('Connected to WebSocket server');
	// 		streamDeck.logger.info('sending: ' + JSON.stringify(event));
	// 		this._ws.send(JSON.stringify(event));
	// 	  });

	// 	  this._ws.on('message', (data) => {
	// 		streamDeck.logger.info(`Received from server: ${data}`);
	// 	  });
	// }

	/**
	 * The {@link SingletonAction.onWillAppear} event is useful for setting the visual representation of an action when it becomes visible. This could be due to the Stream Deck first
	 * starting up, or the user navigating between pages / folders etc.. There is also an inverse of this event in the form of {@link streamDeck.client.onWillDisappear}. In this example,
	 * we're setting the title to the "count" that is incremented in {@link IncrementCounter.onKeyDown}.
	 */
	override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
		// Capture the action so that we can use it to set the button's image from the animation timer.
		this._action = ev.action;

		streamDeck.logger.info(JSON.stringify(ev));

		this._settings = ev.payload.settings;

		if (this._timer === undefined)
			this._timer = setInterval(() => { this.checkTimer(); }, 1000);

		if (this._animationTimer === undefined)
			this._animationTimer = setInterval(async () => { await this.animateClockAsync(); }, 30);

		await this.updateTimeDisplay();
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<Settings>): Promise<void> {
		//streamDeck.logger.info(ev);

		this._settings = ev.payload.settings;

		this._settings.alarmOn = false;

		await ev.action.setSettings(this._settings);

		await this.updateTimeDisplay();
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
		if (this._mediaPlayer !== undefined) {
			this._settings.alarmOn = false;

			// Add 24 hours to the trigger time.
			let triggerTime = new Date(this._settings.alarmTriggerTime);
			triggerTime.setTime(triggerTime.getTime() + 60 * 60 * 24 * 1000);
			this._settings.alarmTriggerTime = triggerTime.getTime();

			await ev.action.setSettings(this._settings);

			exec(`taskkill /PID ${this._mediaPlayer.pid} /F`);
			this._mediaPlayer = undefined;

			await this.updateTimeDisplay();

			return;
		}

		if (this._settings.alarm === undefined)
			this._settings.alarmOn = false;

		if (this._settings.alarmOn == true) {
			// Because the dropdown stores the value as string, we need to hack it into a number.
			this._settings.minute += parseInt(this._settings.increment.toString());

			if (this._settings.minute >= 60) {
				this._settings.minute = 0;
				this._settings.alarmOn = false;
			}
			else {
				let nextAlarm = new Date();
				nextAlarm.setHours(this._settings.hour);
				nextAlarm.setMinutes(this._settings.minute);
				nextAlarm.setSeconds(0);
				nextAlarm.setMilliseconds(0);

				if (nextAlarm.getTime() < new Date().getTime())
					nextAlarm.setTime(nextAlarm.getTime() + 60 * 60 * 24 * 1000);

				streamDeck.logger.info("Updating alarm: " + nextAlarm);
				this._settings.alarmTriggerTime = nextAlarm.getTime();
			}
		}
		else {
			this._settings.alarmOn = !this._settings.alarmOn;

			if (this._settings.minute === undefined)
				this._settings.minute = 0;

			let nextAlarm = new Date();
			nextAlarm.setHours(this._settings.hour);
			nextAlarm.setMinutes(this._settings.minute);
			nextAlarm.setSeconds(0);
			nextAlarm.setMilliseconds(0);

			if (nextAlarm.getTime() < new Date().getTime())
				nextAlarm.setTime(nextAlarm.getTime() + 60 * 60 * 24 * 1000);

			streamDeck.logger.info("Turning alarm on: " + nextAlarm);
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

		await this.updateTimeDisplay();
	}

	checkTimer(): void {
		if (this._settings?.alarmOn == true) {
			let triggerTime = new Date(this._settings.alarmTriggerTime);

			if (triggerTime < new Date() && this._mediaPlayer === undefined) {
				this._mediaPlayer = spawn("powershell", ["-ExecutionPolicy", "Bypass", "-File", "sounds/PlaySound.ps1", this._settings.alarm],
					{
						shell: false
					});
			}
		}
	}

	async animateClockAsync(): Promise<void> {
		if (this._mediaPlayer === undefined) {
			this._clockColor = this._clockColorBase;
			this._animationPosition = 0;
		}
		else if (this._animationPosition % 5 == 0) {
			if (this._clockColor == this._clockColorFlash)
				this._clockColor = this._clockColorBase;
			else
				this._clockColor = this._clockColorFlash;

			this._animationPosition = (this._animationPosition + 1) % this._frameCount;
		}

		await this.updateTimeDisplay();
	}

	// ev: WillAppearEvent<Settings> | DidReceiveSettingsEvent<Settings> | KeyDownEvent<Settings>
	async updateTimeDisplay(): Promise<void> {
		//const { settings } = ev.payload;


		let hour = this._settings?.hour ?? 0;
		let minutes = this._settings?.minute.toString() ?? "00";
		let alarmOn = this._settings?.alarmOn ?? false;

		// if (settings.alarmOn == true) {
		// 	const triggerTime = new Date(settings.alarmTriggerTime);
		// 	//hour = triggerTime.getHours();
		// 	//minutes = triggerTime.getMinutes().toString();
		// 	if (minutes.length < 2)
		// 		minutes = "0" + minutes;
		// }

		if (minutes.length < 2)
			minutes = "0" + minutes;

		let ampm = "am";
		if (hour > 11 && hour < 24)
			ampm = "pm";

		if (hour > 12)
			hour -= 12;

		let image = await this.createTextImage(`${hour}:${minutes} ${ampm}`, alarmOn);


		//await ev.action.setImage(image);
		//streamDeck.ui.onSendToPlugin()
		//await streamDeck.ui.current?.action.setImage(image);

		// if(this._setImage !== undefined)
		// 	await this._setImage(image);

		// streamDeck.actions.forEach(value => {
		// 	streamDeck.actions.getActionById(value.id)?.setImage(image);
		// 	streamDeck.logger.info(value.id);
		// })

		this._action?.setImage(image);
	}


	// Function to create an image with text and return it as a base64 string
	async createTextImage(text: string, alarmOn: boolean, width = 72, height = 72): Promise<string> {
		// Create a blank image
		const image = new Jimp({ width: width, height: height, color: '#00000000' });

		const background = await Jimp.read('imgs/quickclock/alarm-clock-key.png');

		// https://github.com/jimp-dev/jimp/issues/537
		background.color([{ apply: "xor", params: [this._clockColor] }]);

		let offset = 0;

		if (this._mediaPlayer !== undefined)
			offset = Math.sin((360 * Math.PI / 180) / (this._frameCount + 1) * this._animationPosition);

		background.scale(1 + (.1 * offset));
		background.rotate(20 * offset,);

		//streamDeck.logger.info(`${this._animationPosition}: ${background.width}, ${background.height}`);

		//background.displace()

		//image.blit(background);
		image.blit({ src: background, x: (background.width - 72) / -2, y: (background.height - 72) / -2 });
		//image.displace(background, {offset: 10});



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
	minute: number;
	increment: number;
	alarm: string; // The audio file to play
	alarmOn: boolean;
	alarmTriggerTime: number;
};
