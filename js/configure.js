
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

$(document).ready(() => {

    function getFormValues() {
        let channels = fields.channels.val().trim();
        if(channels.length == 0) {
            channels = null;
        } else {
            channels = channels.split(',').map(function(item) { return item.trim() });
        }
        return {
            channels: channels,
            autoComplete: fields.autoComplete.prop('checked'),
            tabComplete: fields.tabComplete.prop('checked'),
            emoteMenu: fields.emoteMenu.prop('checked'),
            emoteTooltips: fields.emoteTooltips.prop('checked'),
            twitchGlobalEmotes: fields.twitchGlobalEmotes.prop('checked'),
            bttvGlobalEmotes: fields.bttvGlobalEmotes.prop('checked'),
            ffzGlobalEmotes: fields.ffzGlobalEmotes.prop('checked'),
            stripedChat: fields.stripedChat.prop('checked'),
        }
    }

    function loadFormValues() {
        if(!syncConfig || Object.keys(syncConfig).length == 0) return;

        if(syncConfig.channels)
            fields.channels.val(syncConfig.channels.join(','));

        fields.autoComplete.prop('checked', syncConfig.autoComplete);
        fields.tabComplete.prop('checked', syncConfig.tabComplete);
        fields.emoteMenu.prop('checked', syncConfig.emoteMenu);
        fields.emoteTooltips.prop('checked', syncConfig.emoteTooltips);
        fields.twitchGlobalEmotes.prop('checked', syncConfig.twitchGlobalEmotes);
        fields.bttvGlobalEmotes.prop('checked', syncConfig.bttvGlobalEmotes);
        fields.ffzGlobalEmotes.prop('checked', syncConfig.ffzGlobalEmotes);
        fields.stripedChat.prop('checked', syncConfig.stripedChat);
    }

    let configureForm = $('#configureForm');

    let fields = {
        channels: configureForm.find('#channels'),
        autoComplete: configureForm.find('#enableAutoComplete'),
        tabComplete: configureForm.find('#enableTabComplete'),
        emoteMenu: configureForm.find('#enableEmoteMenu'),
        emoteTooltips: configureForm.find('#enableEmoteTooltips'),
        twitchGlobalEmotes: configureForm.find('#enableTwitchGlobalEmotes'),
        bttvGlobalEmotes: configureForm.find('#enableBTTVGlobalEmotes'),
        ffzGlobalEmotes: configureForm.find('#enableFFZGlobalEmotes'),
        stripedChat: configureForm.find('#enableStripedChat'),
    }

    fields.channels.on('input', function(evt) {
        fields.channels.val(fields.channels.val().toLowerCase())
    })

    loadSyncStorage(loadFormValues);
    loadLocalStorage();

    configureForm.on('submit', function(e) {
        e.preventDefault();
        
        let oldChannels = syncConfig.channels;
        let saveData = getFormValues();
        syncConfig = saveData;
        saveSyncStorage();
        
        // refresh emotes
        if(oldChannels !== syncConfig.channels) {
            localConfig.lastUpdate = null;

            saveLocalStorage()

            chrome.runtime.sendMessage({ method: "refreshCache" }, function (response) {
                console.log('refreshCache response: ', response);
            });

        }
    })
})