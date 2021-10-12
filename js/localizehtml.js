var messageRegex = /__MSG_(\w+)__/g;
function localizeHtmlPage(elm) {
    elm.innerHTML = elm.innerHTML.replace(messageRegex, localizeString);
    // for (var i = 0; i < elm.children.length; i++) {
    //     localizeHtmlPage(elm.children[i]);
    //     if (elm.children[i].hasAttributes()) {
    //         for (var j = 0; j < elm.children[i].attributes.length; j++) {
    //             elm.children[i].attributes[j].name = elm.children[i].attributes[j].name.replace(messageRegex, localizeString);
    //             elm.children[i].attributes[j].value = elm.children[i].attributes[j].value.replace(messageRegex, localizeString);
    //         }
    //     }
    //     if (elm.children[i].innerHTML.length) {
    //         elm.children[i].innerHTML = elm.children[i].innerHTML.replace(messageRegex, localizeString);
    //     }
    // }
}

function localizeString(_, str) {
    return str ? chrome.i18n.getMessage(str) : "";
}

localizeHtmlPage(document.body);