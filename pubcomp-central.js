var net = require( 'net' ),
	config = require( './config' );

const VERSION = 1;

var server = net.createServer();
server.on( 'connection', handleConnection );
server.listen( config.port );

var servers = {};

function handleConnection( socket ) {
	if ( config.allowedAddresses.indexOf( socket.remoteAddress ) == -1 ) {
		console.log( 'Invalid connection from ' + socket.remoteAddress );
		socket.destroy();
		return;
	}
	console.log( 'Connection from ' + socket.remoteAddress );

	var buffer = '';

	// Recieved/sent in ascii, because JSON escapes Unicode and ascii parsing is faster
	socket.setEncoding( 'ascii' );

	socket.setKeepAlive( true );

	socket.on( 'data', function( data ) {
		buffer += data;

		if ( buffer.indexOf( '\0' ) ) {
			var messages = buffer.split( '\0' );
			buffer = messages.pop();
			messages.forEach( function( message ) {
				processMessage( JSON.parse( message ), socket );
			} );
		}
	} );

	socket.on( 'error', function( error ) {
		console.log( error );
	} );

	socket.on( 'close', function( had_error ) {
		console.log( 'Connection to ' + socket.remoteAddress + ' lost!' );
	} );
}

function write( data, socket ) {
	socket.write( JSON.stringify( data ) + '\0' );
}

function updateState( type, data, ip ) {
	if ( !( ip in servers ) || servers[ip].type != type ) {
		servers[ip] = {
			type: type,
			data: data
		};
		return;
	}
	if ( 'data' in data && 'data' in servers[ip] ) {
		data.data = servers[ip].data + data.data;
	}
	servers[ip].data = data;
}

function processMessage( data, socket ) {
	switch ( data.type ) {
		case 'hello':
			if ( data.version != VERSION ) {
				console.log( socket.remoteAddress + ' is version ' + data.version + ', expecting ' + VERSION );
				write( { type: 'update', version: VERSION }, socket );
			} else {
				write( { type: 'hello', version: VERSION }, socket );
			}
			break;
		case 'tfdsUpdate':
			updateState( 'update', data, socket.remoteAddress );
			break;
		default:
			console.log( 'Got unknown message type ' + data.type );
			console.log( data );
			console.log( 'from ' + socket.remoteAddress );
	}
}
