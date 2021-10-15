//
// runtime.js
//
{
    function init() {
        
        $(document).ready(() => {
            console.log('[EMOTES4BOOYAH] init')

            let syncConfig;
            let localConfig;

            loadUsername();
        
            chrome.runtime.sendMessage({ method: "syncConfig" }, function (response) {
                syncConfig = response;
            });
        
            chrome.runtime.sendMessage({ method: "localConfig" }, function (response) {
                localConfig = response;
            });
        
            chrome.runtime.sendMessage({ method: "refreshCache" }, function (response) {
                console.log('refreshCache response: ', response);
            });
        
            // username list
            let chatUsernames = new Set();
            // chatUsernames.add('teste1')
            // chatUsernames.add('teste5')
            // chatUsernames.add('teste42')

            let $profileCard = $('.components-profile-card ');
            let streamerUsername = $profileCard.find('.user-name').text();

            chatUsernames.add(streamerUsername);

            // chat messages
            let urlExpression = /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?/gi;
            let urlRegex = new RegExp(urlExpression);
        
            let chatObserver = new MutationObserver(function (mutations) {
                mutations.forEach(function (mutation) {
                    if (mutation.type == "childList" && mutation.addedNodes.length) {
        
                        let $message = $(mutation.addedNodes[0]);
                        if ($message.length == 0) return;
                        $message.attr('obsign', true);
        
                        // chat usernames track
                        let $usermenu = $message.find('.components-chatbox-user-menu');
                        let username = $usermenu.find('.username').text();
                        if(username.trim().length > 1) {
                            chatUsernames.add(username);
                        }
                        //
        
                        let $messageText = $message.find('.message-text');

                        // add highlight when mentioned
                        if(syncConfig.mentionHighlight && localStorage.username && $messageText.text().toLowerCase().includes(localStorage.username.toLowerCase())) {
                            $message.addClass('mention-highlight');
                        }
        
                        // check emotes
                        let tokens = $messageText.text().split(' ');
                        let foundModifier = 0;
                        for (let i = 0; i < tokens.length; i++) {
                            let token = tokens[i];
                            let foundEmote = getEmoteHtml(token);
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
        
            let chatObserverRetries=0;
            /**
             * 
             */
            function observeChatMessages() {
                var chatContainer = document.querySelector('.components-chatbox-message-list');
                if (!chatContainer) {
                    chatObserverRetries++;
                    if(chatObserverRetries > 3) return;
                    setTimeout(observeChatMessages, 1000);
                    return;
                }
                let element = document.querySelector('div.message-list .scroll-container');
                $(element).append($(`<div class="message-connection-status">Emotes4Booyah loaded!</div>`))
                chatObserver.observe(element, {
                    childList: true
                });

                loadChatConfig();
                
                console.log('chat observer created')
            }
            observeChatMessages();
        
            /**
             * 
             * @param {string} text 
             */
            function getEmoteHtml(text) {
                let emote = localConfig.emoteMap[text];
                if (emote) {
                    return `<img src="${emote.url}" class="E4Bemote tippy" alt="${text}" title="Emote: ${text}\n${emote.from}" >`;
                }
                return null;
            }
        
            /**
             * 
             * @param {string} text 
             */
            function getHtmlAnchor(text) {
                var href = text;
                if (!text.startsWith('http://') && !text.startsWith('https://')) {
                    href = 'https://' + text;
                }
                return `<a href="${href}" target="_blank" >${text}</a>`;
            }
        
            /**
             * 
             */
            function loadChatConfig() {

                chrome.runtime.sendMessage({ method: "syncConfig" }, function (response) {
                    syncConfig = response;

                    let $chatContainer = $('.components-chatbox-message-list');
                
                    // striped chat opts
                    if(syncConfig.stripedChat) {
                        $chatContainer.addClass('striped');
                    }
            
                    loadChatEditor($chatContainer);
                    processChannelDescription();
                });
                
            }
            
            let $chatboxEditor;
            /**
             * 
             * @param {jQuery} $chatContainer 
             */
            function loadChatEditor($chatContainer) {
                $chatboxEditor = $('.components-desktop-chatroom .components-chatbox-editor .editor-container');
                // need to check and wait for editor/input/emotes area load
                if($chatboxEditor.length == 0) {
                    setTimeout(() => {
                        loadChatEditor($chatContainer);
                    }, 1000);
                    return;
                }
                var $sendButton = $chatboxEditor.find('button.send-btn');
        
                if(syncConfig.emoteMenu) {
                    let $newButton = $('<div class="E4B-emote-menu-opener"><div class="E4B-btn"></div></div>')
                    $newButton.find('.E4B-btn').append(`<img src="${chrome.runtime.getURL('images/icon48.png')}" class="E4B-menu-button">`)
                    $chatboxEditor.append($newButton);
        
                    tippy($newButton[0], {
                        placement: 'top-end',
                        duration: 0,
                        content: 'Emote Menu em breve!',
                    });
                }
        
                let $input = $chatboxEditor.find('.components-input-element');
        
                // user mention
                let $showingList;
                $input.on('input', function(evt) {
                    let val = $input.val();
        
                    let wordInfo = getWordAtCursor(this);

                    if(wordInfo.word.startsWith('@')) {
                        // @ mention
                        wordInfo.begin++; // keep @ when replace
                        let username = wordInfo.word.replace('@', '');
                        let list = searchUsernames(username);
        
                        if(list.length == 0) { // remove if none found
                            if($showingList) {
                                $showingList.remove();
                                $showingList = null;
                            }
                            return
                        }
        
                        if(!$showingList) {
                            $showingList = $('<div class="E4B-input-list"><ul></ul></div>')
                            var $inputBox = $chatboxEditor.find('.input-container .input-box .components-input-textarea');
                            $inputBox.prepend($showingList);
        
                            $showingList.on('click', 'li', evt => {
                                replaceInputText(val, evt.target.innerText, wordInfo, $input);
                                $showingList.remove();
                                $showingList = null;
                            });
                        }
        
                        let $ul = $showingList.find('ul');
                        $ul.css({ maxHeight: $chatContainer.outerHeight() });
                        $ul.empty();
        
                        list.forEach((username, idx) => {
                            $ul.append(`<li class="${idx==0?'active':''}">${username}</li>`);
                        })
                    } else if(wordInfo.word.startsWith(':') && wordInfo.word.length > 2) {
                        // : emote find
                        let emote = wordInfo.word.replace(':', '');
                        let list = searchEmotes(emote);
        
                        if(list.length == 0) { // remove if none found
                            if($showingList) {
                                $showingList.remove();
                                $showingList = null;
                            }
                            return
                        }
        
                        if(!$showingList) {
                            $showingList = $('<div class="E4B-input-list"><ul></ul></div>');
                            var $inputBox = $chatboxEditor.find('.input-container .input-box .components-input-textarea');
                            $inputBox.prepend($showingList);
        
                            $showingList.on('click', 'li', evt => {
                                replaceInputText(val, evt.target.getAttribute('code'), wordInfo, $input);
                                $showingList.remove();
                                $showingList = null;
                            });
                        }
        
                        let $ul = $showingList.find('ul');
                        $ul.css({ maxHeight: $chatContainer.outerHeight() });
                        $ul.empty();
        
                        list.forEach((emote, idx) => {
                            $ul.append(`<li class="${idx==0?'active':''}" code="${emote}">${getEmoteHtml(emote)} ${emote}</li>`);
                        })
                    } else {
                        // clear lists
                        if($showingList) {
                            $showingList.remove();
                            $showingList = null;
                        }
                    }
        
                })
        
                // emote tab-complete
                let lastInitialTabInfo = null;
                let lastTabbedIndex = null;
                let lastTabbedMatches = null;
                $input.on('keydown', function(e) {
                    let val = $input.val();
                    // emote/mention list control
                    if(e.keyCode == 38) { // arrow up
                        if($showingList) {
                            e.preventDefault();
        
                            let activeLi = $showingList.find('li.active');
                            activeLi.removeClass('active');
                            let prevLi = activeLi.prev();
                            if(prevLi.length == 0) { // go to start
                                prevLi = activeLi.siblings().last();
                            }
                            prevLi.addClass('active');

                            prevLi.ensureVisible();
                        }
                    } 
                    if(e.keyCode == 40) { // arrow down
                        if($showingList) {
                            e.preventDefault();
        
                            let activeLi = $showingList.find('li.active');
                            activeLi.removeClass('active');
                            let nextLi = activeLi.next();
                            if(nextLi.length == 0) { // go to start
                                nextLi = activeLi.siblings().first();
                            }
                            nextLi.addClass('active');
        
                            nextLi.ensureVisible();
                        }
                    }
        
                    // chat send override (booyah don't send whats put into it without user interaction/blur+focus etc plus having to click send button)
                    if(e.keyCode == 13) {
                        e.preventDefault();
                        e.stopPropagation();
        
                        // enter interaction with emote/mention list
                        if($showingList) {
                            $showingList.find('li.active').trigger('click');
                            return;
                        }
        
                        $input[0].setSelectionRange(val.length, val.length);
        
                        $input.trigger('blur');
                        $input.trigger('focus');
                        $sendButton.trigger('click');
                        return;
                    }
                    // emote tab-complete
                    if (val && e.keyCode == 9) {
                        e.preventDefault();
                        if(val.length < 2) return;
        
                        let wordInfo = getWordAtCursor(this);
                        if(!lastInitialTabInfo) {
                            lastInitialTabInfo = wordInfo;
                            lastTabbedIndex = null;
                            lastTabbedMatches = searchEmotes(lastInitialTabInfo.word);
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
        
                        replaceInputText(val, nextEmote, lastInitialTabInfo, $input);
                        return;
                    }
                    lastInitialTabInfo = null;
                });
            }
        
            /**
             * 
             * @param {string} text 
             * @param {string} method 
             */
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
        
            function searchUsernames(text, method='startsWith') {
                let matchList = [];
        
                chatUsernames.forEach(username => {
                    if(username.toLowerCase()[method](text.toLowerCase())) {
                        matchList.push(username);
                    }
                })
                return matchList;
            }
        
            /**
             * 
             * @param {HTMLInputElement} input 
             */
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
        
            /**
             * 
             * @param {string} val 
             * @param {string} replaceWord 
             * @param {*} wordInfo 
             * @param {jQuery} $input 
             */
            function replaceInputText(val, replaceWord, wordInfo, $input) {
                let strp1 = val.substring(0, wordInfo.begin);
                let strp2 = val.substring(wordInfo.end, val.length);
        
                let resultstr = strp1+replaceWord+' ';
                wordInfo.end = resultstr.length;
                resultstr += strp2;
        
                $input.val(resultstr);
                $input.text(resultstr);
                $input[0].setSelectionRange(wordInfo.end, wordInfo.end);
            }
        });
    }

    init();
    $(window).on('popstate', () => {
        setTimeout(() => {
            init();
        }, 2000)
    })

    function loadUsername() {
        if(localStorage.loggedUID) {
            fetch('https://booyah.live/api/v3/users/'+localStorage.loggedUID)
            .then(r=>r.json())
            .then(res=> {
                localStorage.username = res.user.nickname;
            });
        }
    }

    $.fn.ensureVisible = function () {
        let $container = this.parent();

        //Determine container top and bottom
        let cTop = $container[0].scrollTop;
        let cBottom = cTop + $container[0].clientHeight;

        //Determine element top and bottom
        let eTop = this[0].offsetTop;
        let eBottom = eTop + this[0].clientHeight;

        //Check if out of view
        if (eTop < cTop) {
            $container[0].scrollTop -= (cTop - eTop);
        } else if (eBottom > cBottom) {
            $container[0].scrollTop += (eBottom - cBottom);
        }
    };

    function processChannelDescription() {
        let $channelBox = $('.channel-content .channel-box');
        let $channelDescription = $channelBox.find('.channel-description');

        let newContent = $channelDescription.text()
        .replace(/(\b(https?|):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi, "<a href='$1'>$1</a>")
        .replace(/(^|[^\/])(www\.[\S]+(\b|$))/gim, '$1<a target="_blank" href="http://$2">$2</a>')
        .replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, '<a target="_blank" href="mailto:$1" rel="noopener noreferrer">$1</a>');

        $channelDescription.html(newContent);
    }

}
