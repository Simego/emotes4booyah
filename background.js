// background.js
{
const twitchAuthURL = 'https://id.twitch.tv/oauth2/token?client_id={tcid}&grant_type=client_credentials&client_secret={tcs}';
const twitchUserURL = 'https://api.twitch.tv/helix/users?login={user}';
const twitchGlobalURL = 'https://api.twitch.tv/helix/chat/emotes/global';
const ffzURL = 'https://api.frankerfacez.com/v1/room/{user}';
const ffzGlobalURL = 'https://api.frankerfacez.com/v1/set/global';
const bttvURL = 'https://api.betterttv.net/3/cached/users/twitch/{twitch_id}';
const bttvGlobalURL = 'https://api.betterttv.net/3/cached/emotes/global';
const bttvEmoteURL = 'https://cdn.betterttv.net/emote/{id}/1x';
const MINS_CACHE = 24*60;

let tcid, tcs;
fetch(chrome.runtime.getURL('config.json')).then(r=>r.json()).then(j=>{tcid=j.tcid;tcs=j.tcs;})

function loadSyncStorage(callback) {
	chrome.storage.sync.get(data => { syncConfig = data; callback && callback(data) });
}
function saveSyncStorage() {
	chrome.storage.sync.set(syncConfig)
}
function loadLocalStorage(callback) {
	chrome.storage.local.get(data => { localConfig = data; callback && callback(data) });
}
function saveLocalStorage() {
	chrome.storage.local.set(localConfig)
}

let syncConfig;
let localConfig;
loadSyncStorage();
loadLocalStorage();

chrome.runtime.onInstalled.addListener(() => {
	loadSyncStorage(function (data) {
		syncConfig = data;
		if (Object.keys(syncConfig).length == 0) {
			syncConfig = {
				channels: null,
				autoComplete: true,
				tabComplete: true,
				emoteMenu: true,
				emoteTooltips: false,
				twitchGlobalEmotes: true,
				ffzGlobalEmotes: true,
				bttvGlobalEmotes: true,
				stripedChat: true,
				mentionHighlight: true,
				showTimestamp: false,
				twitch: null
			};
			saveSyncStorage();
		}
	});
	loadLocalStorage(function (data) {
		localConfig = data;
		if (Object.keys(localConfig).length == 0) {
			localConfig = {
				ffz: {
					global: {},
					channels: {}
				},
				bttv: {
					global: {},
					channels: {}
				},
				twitch: {
					global: {}
				},
				emoteMap: {},
				lastUpdate: null,
				twitchUserIds: {},
				twitchGlobalLoaded: false,
				FFZGlobalLoaded: false,
				BTTVGlobalLoaded: false
			}
			saveLocalStorage();
		}
	});

	refreshCache(status => {
		
	});

	checkTwitchToken();

	console.log('installed')
});

chrome.runtime.onStartup.addListener(() => {
	console.log('startup')
});

chrome.runtime.onSuspend.addListener(() => {
	console.log('suspend')
});

chrome.runtime.onConnect.addListener(() => {
	console.log('connect')
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	// console.log('requesting ', request)
	switch (request.method) {
		case 'localConfig':
			loadLocalStorage(sendResponse);
			return true;
		case 'syncConfig':
			loadSyncStorage(sendResponse);
			return true;
		case 'refreshCache':
			checkTwitchToken();
			loadSyncStorage(() => {
				updateTwitchIds(function(updated) {
					refreshCache(sendResponse);
				})
			});
			return true;
		default:
			sendResponse(null);
			break;
	}
});

// listen to changes
chrome.storage.onChanged.addListener(function (changes, namespace) {
	for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
		console.log(
			`Storage key "${key}" in namespace "${namespace}" changed.`,
			`Old value was "${oldValue}", new value is "${newValue}".`
		);
	}
});

function checkTwitchToken() {
	if (syncConfig.twitch && syncConfig.twitch.expires > new Date().getTime()) {
		// console.log(syncConfig.twitch);
		return;
	};

	fetch(
		twitchAuthURL.replace('{tcid}', tcid).replace('{tcs}', tcs),
		{
			method: 'POST'
		}
	)
		.then(r => r.json())
		.then(result => {
			let dNow = new Date();
			dNow.setSeconds(result.expires_in);
			syncConfig.twitch = {
				token: result.access_token,
				expires: dNow.getTime()
			}
			saveSyncStorage()
		})
}

function updateTwitchIds(callback) {
	if (syncConfig.channels && syncConfig.twitch && syncConfig.twitch.token) {

		let promises = [];
		syncConfig.channels.forEach(channel => {

			// ignora caso ja exista a chave
			if(localConfig.twitchUserIds[channel]) return;

			promises.push(fetch(twitchUserURL.replace('{user}', channel),
				{
					method: 'GET',
					headers: {
						'Accept': 'application/vnd.twitchtv.v5+json',
						'Client-Id': tcid,
						'Authorization': 'Bearer ' + syncConfig.twitch.token
					},
				})
				.then(r => r.json())
				.then(result => {
					
					localConfig.twitchUserIds[channel] = result.data[0].id;
				})
			)
		})

		Promise.allSettled(promises).then(([result]) => {
			saveLocalStorage();
			callback(true);
		});

	} else {
		callback(false);
	}
}

function refreshCache(callback) {

	// loadSyncStorage();
	loadLocalStorage(data => {
		localConfig = data;

		if (!localConfig || !syncConfig) return;

		let lastUpdate = localConfig.lastUpdate;
		if (lastUpdate && ((new Date().getTime() - lastUpdate) / 1000 / 60) > MINS_CACHE) {
			callback(false);
			return;
		};

		let promises = [];

		// Twitch Global
		if(!localConfig.twitchGlobalLoaded && syncConfig.twitchGlobalEmotes && syncConfig.twitch && syncConfig.twitch.token) {
			promises.push(fetch(twitchGlobalURL,
				{
					method: 'GET',
					headers: {
						'Accept': 'application/vnd.twitchtv.v5+json',
						'Client-Id': tcid,
						'Authorization': 'Bearer ' + syncConfig.twitch.token
					},
				})
				.then(r => r.json())
				.then(result => {
					
					var emotes = result.data;

					emotes.forEach(emote => {
						localConfig.emoteMap[emote.name] = {
							name: emote.name,
							url: emote.images["url_1x"],
							from: 'Twitch Global'
						};
					})

					console.log('Updated Twitch Global')
					localConfig.twitchGlobalLoaded = true;
					return true;
				})
			)
		}

		// FFZ Global
		if(!localConfig.FFZGlobalLoaded && syncConfig.ffzGlobalEmotes) {
			promises.push(fetch(ffzGlobalURL)
				.then(r => r.json())
				.then(ffzInfo => {
					let emotes = ffzInfo.sets[ffzInfo.default_sets[0]].emoticons;
					localConfig.ffz.global = ffzInfo;

					emotes.forEach(emote => {
						localConfig.emoteMap[emote.name] = {
							name: emote.name,
							url: emote.urls[1],
							from: 'FrankerFaceZ Global'
						};
					})

					console.log('Updated FFZ Global')
					localConfig.FFZGlobalLoaded = true;
					return true;
				})
			)
		}

		// BTTV Global
		if(!localConfig.BTTVGlobalLoaded && syncConfig.bttvGlobalEmotes) {
			promises.push(fetch(bttvGlobalURL)
				.then(r => r.json())
				.then(bttvInfo => {
					localConfig.bttv.global = bttvInfo;

					bttvInfo.forEach(emote => {
						localConfig.emoteMap[emote.code] = {
							name: emote.code,
							url: bttvEmoteURL.replace('{id}', emote.id),
							from: 'BetterTTV Global'
						};
					})

					console.log('Updated BTTV Global')
					localConfig.BTTVGlobalLoaded = true;
					return true;
				})
			)
		}

		loadSyncStorage(data => {
			syncConfig = data;

			if (syncConfig.channels) {

				syncConfig.channels.forEach(channel => {

					// FFZ
					promises.push(fetch(ffzURL.replace('{user}', channel))
						.then(r => r.json())
						.then(ffzInfo => {
							let emotes = ffzInfo.sets[ffzInfo.room.set].emoticons;
							localConfig.ffz.channels[channel] = ffzInfo;

							emotes.forEach(emote => {
								localConfig.emoteMap[emote.name] = {
									name: emote.name,
									url: emote.urls[1],
									from: `FrankerFaceZ (${channel})`
								};
							});

							console.log(`Updated FFZ Channel ${channel}`)
							return true;
						})
					)

					// BTTV
					if(syncConfig.twitch && syncConfig.twitch.token) {
						promises.push(fetch(bttvURL.replace('{twitch_id}', localConfig.twitchUserIds[channel]))
							.then(r => r.json())
							.then(bttvInfo => {
								localConfig.bttv.channels[channel] = bttvInfo;

								let emotes = [].concat(bttvInfo.sharedEmotes).concat(bttvInfo.channelEmotes);

								emotes.forEach(emote => {
									localConfig.emoteMap[emote.code] = {
										name: emote.code,
										url: bttvEmoteURL.replace('{id}', emote.id),
										from: `BTTV (${channel})`
									};
								});

								console.log(`Updated BTTV Channel ${channel}`)
								return true;
							})
						)
					}

				});

			}
		});

		Promise.allSettled(promises).then(([result]) => {
			localConfig.lastUpdate = new Date().getTime();
			saveLocalStorage();
			callback(true);
		});

	});

}

}