import streamDeck, { DialAction, KeyAction } from "@elgato/streamdeck";
import { ChildProcess, exec, spawn } from "child_process";
import { HorizontalAlign, Jimp, JimpMime, loadFont, VerticalAlign } from "jimp";
import { promises as fs } from "fs";

type Color = { r: number, g: number, b: number };

export class Instance {
    private readonly _action: KeyAction | DialAction;
    public Settings: Settings;

    private readonly _clockColorBase: Color = { r: 0x4c, g: 0x4c, b: 0x4c };
	private readonly _clockColorFlash: Color = { r: 0xde, g: 0xe2, b: 0x00 };

    private readonly _timeColorUnset: Color = { r: 0xbb, g: 0xbb, b: 0xbb };
    private readonly _timeColorSet: Color = { r: 0x00, g: 0xff, b: 0x00 };
    private readonly _timeColorAlarm: Color = { r: 0x00, g: 0xf9, b: 0xff };
    private readonly _frameCount = 25; // The number of frames per second to run the animation.

    private _timer: NodeJS.Timeout | undefined = undefined;
	private _animationTimer: NodeJS.Timeout | undefined = undefined;
    private _mediaPlayer: ChildProcess | undefined = undefined;
    private  _currentFrame = 0; // The current animation frame.
    private  _clockColor: Color = this._clockColorBase;
	
    get ActionId() : string {
        return this._action.id;
    }

    get IsPlaying() : boolean {
        return this._mediaPlayer !== undefined;
    }

    constructor(action: KeyAction | DialAction, settings: Settings) {
        this._action = action;
        this.Settings = settings;

        if (this._timer === undefined)
			this._timer = setInterval(() => { this.checkTimer(); }, 1000);

		if (this._animationTimer === undefined)
			this._animationTimer = setInterval(async () => { await this.animateClockAsync(); }, 30);
    }

    async stopPlaying(): Promise<void> {
        if(this._mediaPlayer !== undefined) {
            // I'm hoping this actually works on a mac.
            if(process.platform === 'darwin') {
                this._mediaPlayer.kill();
            }
            else {
                exec(`taskkill /PID ${this._mediaPlayer.pid} /F`);
            }

            this._mediaPlayer = undefined;
        }

        await this.updateTimeDisplay();
    }

    checkTimer(): void {
		if (this.Settings?.alarmOn == true) {
			let triggerTime = new Date(this.Settings.alarmTriggerTime);
			let minDateWindow = new Date();
			minDateWindow.setTime(minDateWindow.getTime() - 60 * 1000);

			// If the trigger time is in the past AND the trigger time is not older than 1 minute, then sound the alarm. 
			// This way the alarms do not all fire if the user has the computer off. 
			if (triggerTime < new Date() && triggerTime > minDateWindow && this._mediaPlayer === undefined) {
				if(process.platform === 'darwin')
				{
					this._mediaPlayer = spawn("afplay ", [this.Settings.alarm, "-v", "2"],
						{
							shell: false
						});
				}
				else
				{
					this._mediaPlayer = spawn("powershell", ["-ExecutionPolicy", "Bypass", "-File", "sounds/PlaySound.ps1", this.Settings.alarm],
						{
							shell: false
						});
				}
			}
		}
	}

    async animateClockAsync(): Promise<void> {
        if(this.IsPlaying == false)
            return;

		if (this._mediaPlayer === undefined) {
			this._clockColor = this._clockColorBase;
			this._currentFrame = 0;
		}
		else if (this._currentFrame % 5 == 0) {
			if (this._clockColor == this._clockColorFlash)
				this._clockColor = this._clockColorBase;
			else
				this._clockColor = this._clockColorFlash;	
		}

		this._currentFrame = (this._currentFrame + 1) % this._frameCount;
		
		await this.updateTimeDisplay();
	}

	async updateTimeDisplay(): Promise<void> {
		let hour = parseInt(this.Settings?.hour) ?? 0;
		let minutes = this.Settings?.minute?.toString() ?? "00";
		let alarmOn = this.Settings?.alarmOn ?? false;

		if (minutes.length < 2)
			minutes = "0" + minutes;

		let ampm = "am";
		if (hour > 11 && hour < 24)
			ampm = "pm";

		if (hour > 12)
			hour -= 12;

		let image = await this.createTextImage(`${hour}:${minutes} ${ampm}`, alarmOn);

        if(image !== undefined)
		    this._action?.setImage(image);
	}

    /**
     * Function to create an image with text and return it as a base64 string
     * @param text 
     * @param alarmOn 
     * @param width 
     * @param height 
     * @returns 
     */
	async createTextImage(text: string, alarmOn: boolean, width = 72, height = 72): Promise<string | undefined> {
		// Create a blank image
		const image = new Jimp({ width: width, height: height, color: '#00000000' });

		const background = await Jimp.read('imgs/quickalarm/alarm-clock-key-black.png');

		// https://github.com/jimp-dev/jimp/issues/537 -- Source bitmap must be black!
		background.color([{ apply: "xor", params: [this._clockColor] }]);

		let offset = 0;

		if (this._mediaPlayer !== undefined)
			offset = Math.sin((360 * Math.PI / 180) / (this._frameCount + 1) * this._currentFrame);

		background.scale(1 + (.1 * offset));
		background.rotate(20 * offset,);

		image.blit({ src: background, x: (background.width - 72) / -2, y: (background.height - 72) / -2 });

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

			// https://github.com/jimp-dev/jimp/issues/537 -- Source bitmap must be black!
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

		let fontColor = this._timeColorUnset;
		
        if (alarmOn == true)
			fontColor = this._timeColorSet;

        if(this.IsPlaying == true)
            fontColor = this._timeColorAlarm;

		// https://github.com/jimp-dev/jimp/issues/537 -- Source bitmap must be black!
		fontImage.color([{ apply: 'xor', params: [fontColor] }]);

		outlineImage.resize({ w: width, h: height });
		fontImage.resize({ w: width, h: height });

		image.blit(outlineImage);

		image.blit(fontImage);

		// Get the base64 string of the image
		const base64Image = await image.getBase64(JimpMime.png);
		return base64Image;
	}
}