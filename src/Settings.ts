type Settings = {
	hour: string; // String because dropdown values in the PI are strings.
	minute: number;
	increment: string; // String because dropdown values in the PI are strings.
	alarm: string; // The audio file to play
	alarmOn: boolean;
	alarmTriggerTime: number;
    defaultsSet: boolean; // Keep the PI reloading until the defaults are applied.
};
