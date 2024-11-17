import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { QuickClock } from "./actions/QuickClock";
import { parseArgs } from "util";
import { WebSocket } from "ws";

//type Args = { port: number, pluginUUID: string,  registerEvent: string};

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel(LogLevel.INFO);




//Register the increment action.
streamDeck.actions.registerAction(new QuickClock());

//Finally, connect to the Stream Deck.
streamDeck.connect();



// Messing around with web sockets, but we can't have both the raw socket and the plugin going at the same time.
// :(
function websocketTest() : void {


	streamDeck.logger.info(process.argv);

	let port: number = 0;
	let pluginUUID: string = "";
	let registerEvent: string = "";
	
	for(var i = 0; i < process.argv.length; i++)
	{
		if(process.argv[i] === "-port")
			port = parseInt(process.argv[++i]);
	
		if(process.argv[i] === "-pluginUUID")
			pluginUUID = process.argv[++i];
	
		if(process.argv[i] === "-registerEvent")
			registerEvent = process.argv[++i];
	}
	
	streamDeck.logger.info(port);
	streamDeck.logger.info(pluginUUID);
	streamDeck.logger.info(registerEvent);
	
	type RegisterEvent = {
		event: string; // -registerEvent parameter
		uuid: string; // -pluginUUID parameter
	};
	
	const event: RegisterEvent = {event: registerEvent, uuid: pluginUUID};
	
	let ws = new WebSocket("ws://localhost:" + port.toString());
	
	ws.on('open', () => {
		streamDeck.logger.info('Connected to WebSocket server');
		streamDeck.logger.info('sending: ' + JSON.stringify(event));
		ws.send(JSON.stringify(event));
		});
	
		ws.on('message', (data) => {
		streamDeck.logger.info(`Received from server: ${data}`);
	
		//const event = JSON.parse(data);
	
		});
}