import streamDeck, { action, DidReceiveSettingsEvent, KeyDownEvent, PropertyInspector, SingletonAction, TitleOptions, WillAppearEvent } from "@elgato/streamdeck";
import { ChildProcess, exec, spawn } from "child_process";
import { Jimp, loadFont, HorizontalAlign, VerticalAlign, JimpMime  } from "jimp";
import { SANS_10_BLACK, SANS_16_BLACK, SANS_16_WHITE } from "jimp/fonts";


/**
 * An example action class that displays a count that increments by one each time the button is pressed.
 */
@action({ UUID: "com.zaphop.quickalarm.increment" })
export class IncrementCounter extends SingletonAction<CounterSettings> {
	_mediaPlayer: ChildProcess | undefined = undefined;

	/**
	 * The {@link SingletonAction.onWillAppear} event is useful for setting the visual representation of an action when it becomes visible. This could be due to the Stream Deck first
	 * starting up, or the user navigating between pages / folders etc.. There is also an inverse of this event in the form of {@link streamDeck.client.onWillDisappear}. In this example,
	 * we're setting the title to the "count" that is incremented in {@link IncrementCounter.onKeyDown}.
	 */
	override onWillAppear(ev: WillAppearEvent<CounterSettings>): void | Promise<void> {
		//return ev.action.setTitle(`${ev.payload.settings.count ?? 0}`);


	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<CounterSettings>): Promise<void> {
		streamDeck.logger.info(ev);

		// const { settings } = ev.payload;

		 const hour = ev.payload.settings.hour; 
		 let image = await this.createTextImage(`${hour}:00`);
		
		 await ev.action.setImage(image);
	}

	/**
	 * Listens for the {@link SingletonAction.onKeyDown} event which is emitted by Stream Deck when an action is pressed. Stream Deck provides various events for tracking interaction
	 * with devices including key down/up, dial rotations, and device connectivity, etc. When triggered, {@link ev} object contains information about the event including any payloads
	 * and action information where applicable. In this example, our action will display a counter that increments by one each press. We track the current count on the action's persisted
	 * settings using `setSettings` and `getSettings`.
	 */
	override async onKeyDown(ev: KeyDownEvent<CounterSettings>): Promise<void> {
		// Update the count from the settings.
		//const { settings } = ev.payload;
		// settings.incrementBy ??= 1;
		// settings.count = (settings.count ?? 0) + settings.incrementBy;

		// Update the current count in the action's settings, and change the title.
		//await ev.action.setSettings(settings);

		if(this._mediaPlayer !== undefined)
		{
			exec(`taskkill /PID ${this._mediaPlayer.pid} /F`);
			this._mediaPlayer = undefined;
		}
		else
		{
			//streamDeck.system.openUrl(ev.payload.settings.alarm);
			//streamDeck.system.openUrl("/Users/Nick/Downloads/ding-126626.mp3");
			//exec('powershell -c (New-Object Media.SoundPlayer "c:/Users/Nick/Downloads/ding-126626.mp3").PlaySync();');
			//let childProcess = spawn(`powershell -ExecutionPolicy Bypass -File sounds/PlaySound.ps1 ${ev.payload.settings.alarm}`, {stdio: "pipe"});
			this._mediaPlayer = spawn("powershell", ["-ExecutionPolicy", "Bypass", "-File",  "sounds/PlaySound.ps1", ev.payload.settings.alarm], 
				{
					//stdio: "pipe",
					shell: false

				});
		}

		// setTimeout(() => {
		// 	//childProcess.stdin?.write("pork");

		// 	console.log(`killing: ${childProcess.pid}`);
		// 	exec(`taskkill /PID ${childProcess.pid} /F`);
			
		// }, 5000);


		//childProcess.kill();

		//playAudioFile(ev.payload.settings.alarm); 
		//let image = await this.createTextImage("24:00");
		
		//await ev.action.setImage(image);

		//await ev.action.setTitle("");
		//await ev.action.setTitle(`${settings.count}`);
 		// powershell -c Add-Type -AssemblyName presentationCore;$mediaPlayer = New-Object system.windows.media.mediaplayer;$mediaPlayer.open('c:/Users/Nick/Downloads/ding-126626.mp3');$mediaPlayer.Play();
		 // powershell -c Add-Type -AssemblyName presentationCore;$mediaPlayer = New-Object system.windows.media.mediaplayer;$mediaPlayer.open('C:\Windows\Media\notify.wav');$mediaPlayer.Play();
	}

	// Function to create an image with text and return it as a base64 string
async createTextImage(text : string, width = 72, height = 72) {
    // Create a blank image
    const image = new Jimp({width: width, height: height, color: '#00000000'});

	const font = await loadFont('fonts/arial-black/arial-black-20-bold.fnt');

    // Add text to the image
    image.print({
        font: font,
        x: 0,
        y: 0,
        text: {
            text: text,
            alignmentX: HorizontalAlign.CENTER,
            alignmentY: VerticalAlign.MIDDLE
        },
		maxWidth: width,
		maxHeight: height
		}
    );

	// https://github.com/jimp-dev/jimp/issues/537
	image.color([{ apply: 'xor', params: [{r: 0xff, g: 0x00, b: 0x00}] }]); 

    // Get the base64 string of the image
    const base64Image = await image.getBase64(JimpMime.png);
	return base64Image;
    //return base64Image.replace(/^data:image\/png;base64,/, ''); // Strip the data URL prefix
}
}

/**
 * Settings for {@link IncrementCounter}.
 */
type CounterSettings = {
	hour: number;
	increment: number;
	alarm: string;
};
