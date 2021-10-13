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

        loadChatEditor($chatContainer);
    }
    
    function loadChatEditor($chatContainer) {
        let $chatboxEditor = $('.components-desktop-chatroom .components-chatbox-editor .editor-container');
        if($chatboxEditor.length == 0) {
            setTimeout(() => {
                loadChatEditor($chatContainer);
            }, 1000);
            return;
        }
        var $sendButton = $chatboxEditor.find('button.send-btn');

        if(syncConfig.emoteMenu) {
            let $originalButton = $chatboxEditor.find('.components-chat-menu-emoji');
            let $newButton = $originalButton.clone();
            $newButton.removeClass('closed theme-dark');

            $originalButton.replaceWith($newButton);
            $newButton.empty();
            $newButton.append(`<img src="${chrome.runtime.getURL('images/icon48.png')}" class="E4B-menu-button">`)

            tippy($newButton[0], {
                placement: 'top-end',
                duration: 0,
                content: 'Emote Menu em breve!',
            });
        }

        let $input = $chatboxEditor.find('.components-input-element');
        $input.on('input', function(evt) {
            let val = $input.val();

        })

        let lastInitialTab = null;
        let lastTabbedIndex = null;
        let lastTabbedMatches = null;
        let lastWordInfo = null;
        $input.on('keydown', function(e) {
            let val = $input.val();
            if(e.keyCode == 13) {
                e.preventDefault();
                e.stopPropagation();
                $input[0].setSelectionRange(val.length, val.length);

                $input.trigger('blur');
                $input.trigger('focus');
                $sendButton.trigger('click');
                return true;
            }
            if (val && e.keyCode == 9) {
                e.preventDefault();
                if(val.length < 3) return;

                let wordInfo = getWordAtCursor(this);
                if(!lastInitialTab) {
                    lastInitialTab = wordInfo;
                    lastTabbedIndex = null;
                    lastTabbedMatches = searchEmotes(lastInitialTab.word);
                }
                
                let nextEmote;
                if(lastTabbedIndex!=null && lastTabbedIndex>-1) {
                    lastTabbedIndex = lastTabbedIndex+1 < lastTabbedMatches.length ? lastTabbedIndex+1 : 0;
                    nextEmote = lastTabbedMatches[lastTabbedIndex];
                } else {
                    lastTabbedIndex = 0;
                    nextEmote = lastTabbedMatches[0];
                }

                if(!nextEmote) return;

                let strp1 = val.substring(0, lastInitialTab.begin);
                let strp2 = val.substring(lastInitialTab.end, val.length);

                let resultstr = strp1+nextEmote+' ';
                lastInitialTab.end = resultstr.length;
                resultstr += strp2;

                $input.val(resultstr);
                $input.text(resultstr);
                $input[0].setSelectionRange(lastInitialTab.end, lastInitialTab.end);

                return;
            }
            lastInitialTab = null;
        });
    }

    function searchEmotes(text, method='startsWith') {
        let list = Object.keys(localConfig.emoteMap).sort((a,b) => a.localeCompare(b));
        let matchList = [];

        list.forEach(emote => {
            if(emote.toLowerCase()[method](text.toLowerCase())) {
                matchList.push(emote);
            }
        })
        return matchList;
    }

    function getWordAtCursor(input) {
        const text = input.value;
        const startIndex = input.selectionStart;
        const endIndex = input.selectionEnd;
        const previousSpaceIndex = text.lastIndexOf(' ', startIndex - 1);
        const nextSpaceIndex = text.indexOf(' ', endIndex);
        const begin = previousSpaceIndex < 0 ? 0 : previousSpaceIndex + 1;
        const end = nextSpaceIndex < 0 ? text.length : nextSpaceIndex;
        const betweenSpaces = text.substring(begin, end);

        return {begin: begin, end: end, word: betweenSpaces};
    }

})
