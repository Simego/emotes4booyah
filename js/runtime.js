//
// runtime.js
//
$(document).ready(function () {
    console.log('dassdaasdsda BOOYAH EMOTES')


    function appendCSS(path) {
        $(document.head).append($(`<link rel="stylesheet" type="text/css" href="${chrome.runtime.getURL(path)}">`))
    }

    // appendCSS('css/runtime.css');
    // appendCSS('css/tippy.min.css');
    // appendCSS('css/translucent.min.css');

    let syncConfig;
    let localConfig;
    let chatLoaded = false;

    chrome.runtime.sendMessage({ method: "syncConfig" }, function (response) {
        syncConfig = response;
        loadChatConfig();
    });

    chrome.runtime.sendMessage({ method: "localConfig" }, function (response) {
        localConfig = response;
    });

    chrome.runtime.sendMessage({ method: "refreshCache" }, function (response) {
        console.log('refreshCache response: ', response);
    });

    // emoji menu
    var $emojiMenuButton;
    var emojiObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.type == "attributes") {
                // console.log($('.components-chat-menu-emoji'))
                if ($emojiMenuButton.hasClass('open')) {
                    var $emojiPopover = $emojiMenuButton.find('.components-chat-menu-emoji-popover');
                    
                    loadEmotesMenu($emojiPopover)

                }
            }
        });
    });

    function observeEmojiPane() {
        let element = document.querySelector('.components-chat-menu-emoji');
        if (!element) {
            setTimeout(observeEmojiPane, 1500);
            return;
        }
        emojiObserver.observe(element, {
            attributes: true
        });
        $emojiMenuButton = $(element);
        console.log('emoji pane observer created')
    }
    observeEmojiPane();

    // chat messages
    let urlExpression = /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?/gi;
    var urlRegex = new RegExp(urlExpression);

    let chatObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.type == "childList" && mutation.addedNodes.length) {

                let $message = $(mutation.addedNodes[0]);
                if ($message.length == 0) return;
                $message.attr('obsign', true);

                let $messageText = $message.find('.message-text');

                // check emotes
                let tokens = $messageText.text().split(' ');
                let foundModifier = 0;
                for (let i = 0; i < tokens.length; i++) {
                    let token = tokens[i];
                    let foundEmote = getEmote(token);
                    if (foundEmote) {
                        foundModifier++;
                        tokens[i] = foundEmote;
                    }
                    if (token.match(urlRegex)) {
                        foundModifier++;
                        tokens[i] = getHtmlAnchor(token);
                    }
                }

                if (foundModifier > 0) {
                    $messageText.html(tokens.join(' '));

                    if (syncConfig.emoteTooltips) {
                        tippy('.message-list .message-text .tippy', {
                            // default
                            placement: 'top-end',
                            duration: 0,
                            // themes: 'translucent',
                            // trigger: 'click'
                            content(reference) {
                                const title = reference.getAttribute('title');
                                reference.classList.remove('tippy')
                                reference.removeAttribute('title');
                                return title;
                            },
                        });
                    }
                }
            }
        });
    });

    function observeChatMessages() {
        var chatContainer = document.querySelector('.components-chatbox-message-list');
        if (!chatContainer) {
            setTimeout(observeChatMessages, 1000);
            return;
        }
        let element = document.querySelector('div.message-list .scroll-container');
        chatObserver.observe(element, {
            childList: true
        });
        
        console.log('chat observer created')
    }
    observeChatMessages();

    function getEmote(text) {
        let emote = localConfig.emoteMap[text];
        if (emote) {
            return `<img src="${emote.url}" class="E4Bemote tippy" alt="${text}" title="Emote: ${text}\n${emote.from}" >`;
        }
        return null;
    }

    function getHtmlAnchor(text) {
        var href = text;
        if (!text.startsWith('http://') && !text.startsWith('https://')) {
            href = 'https://' + text;
        }
        return `<a href="${href}" target="_blank" >${text}</a>`;
    }

    function loadEmotesMenu($emojiPopover) {

        let pickers = $emojiPopover.find('.pickers');
        let $switcher = $emojiPopover.find('.switcher');

    }

    function loadChatConfig() {
        if(!syncConfig) return;

        let $chatContainer = $('.components-chatbox-message-list');
        
        // striped chat opts
        if(syncConfig.stripedChat) {
            $chatContainer.addClass('striped');
        }

        loadEmoteMenu($chatContainer);
    }
    
    function loadEmoteMenu($chatContainer) {
        let $chatboxEditor = $chatContainer.parents('.components-desktop-chatroom').find('.components-chatbox-editor .editor-container');

        if($chatboxEditor.length == 0) {
            setTimeout(() => {
                loadEmoteMenu($chatContainer);
            }, 1000);
            return;
        }

        if(syncConfig.emoteMenu) {
            let $originalButton = $chatboxEditor.find('.components-chat-menu-emoji');
            let $newButton = $originalButton.clone();
            $newButton.removeClass('closed theme-dark');

            $originalButton.replaceWith($newButton);
            $newButton.empty();
            $newButton.append(`<img src="${chrome.runtime.getURL('images/icon48.png')}" class="E4B-menu-button">`)
            // xxx
        }
    }

})
