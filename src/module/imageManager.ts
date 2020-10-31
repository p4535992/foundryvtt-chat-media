import {log, MODULE_NAME} from "./util";
import {getSetting} from "./settings";
import Compressor from './compressor/compressor.esm.js'

const DOM_PARSER = new DOMParser();
const URL_REGEX = /^<a.*>(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])<\/a>$/ig;
const IMAGE_REGEX = /\w+\.(jpg|jpeg|gif|png|tiff|bmp)/ig;


//============================\\
// CONVERT MESSAGES TO IMAGES \\
//============================\\


// builds a string template for a image message
const buildImageHTML = (options: any): string => `<div class="${options.MODULE_NAME}-container"><img src="${options.url}" alt="${options.MODULE_NAME}"></div>`;

// checks if message has only a url
const isURL = (message: string): boolean => !!message.match(URL_REGEX);

// checks if an url is an image url
const isImageURL = (url: string): boolean => !!url.match(IMAGE_REGEX);

// generates an image message
const genImageHTML = (url: string): string => buildImageHTML({MODULE_NAME, url});

// a handler for .replace that returns a string with the buildImageHTML structure or the original string
const replaceMessageWithImage = (text: string, url: string): string => isImageURL(url) ? genImageHTML(url) : text;

// returns an image template from a message content
const convertMessageToImage = (message: string): any => isURL(message) && message.replace(URL_REGEX, replaceMessageWithImage);


//============================\\
// ADDS POPOUT ON IMAGE CLICK \\
//============================\\


// creates an image popout from an image url
const renderPopout = (url: string): Application =>
    new ImagePopout(url, {editable: false, shareable: true}).render(true);

// the on click event that is added for all the images in the chat
const createPopoutOnClick = (imgHTML: HTMLImageElement): Application => renderPopout(imgHTML.src);


//=============================\\
//   CONVERT FILES TO IMAGES   \\
//=============================\\


// returns the file extension from a given file name
const getFileExtensionFromName = (fileName: string): string => fileName.substring(fileName.lastIndexOf('.'), fileName.length) || null;

// generates a long random string used as a file name
const generateRandomString = (): string => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// generates a random file name keeping the file extension
const generateRandomFileName = (fileName: string): string => {
    const fileExtension = getFileExtensionFromName(fileName);
    if (!fileExtension) return fileName;

    return fileExtension ? generateRandomString() + fileExtension : fileName;
};

// compress a given image (Blob/File) and trigger a callback
const compress = (file: Blob | File, compression: number): Function =>
    (sCallback: Function, eCallback: Function): void =>
        new Compressor(file, {
            quality: compression,
            success: sCallback,
            error: eCallback,
        });

// if the pasted/dropped data comes from a website it should have an image.src,
// so we just use that instead of generating a new file (this saves A LOT of space)
const extractURLFromData = (data: any): string => {
    const html = data?.getData('text/html');
    if (!html) return null;

    const parsed = DOM_PARSER.parseFromString(html, 'text/html');
    const img = parsed.querySelector('img');

    return img ? img.src : null;
};

// extract the image file from the paste/drop event
const extractFileFromData = (data: any): File => {
    const items = data?.items;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item?.type?.includes('image')) return item;
    }
    return null;
};

// returns an image from a paste/drop event
// this could be a url/blob depending on the available options
const getImageFromEvent = (event: any): string | File => {
    const data = event?.clipboardData || event?.dataTransfer;
    if (!data) return null;

    const url = extractURLFromData(data);
    return url !== null ? url : extractFileFromData(data);
};

// handles the extraction of the image from the event and calls the appropriate
// action: directly send the message in chat or warn the user first
const handleChatInteraction = (showWarning: boolean, chat: HTMLTextAreaElement, event: any): void | Promise<void> => {
    if (!chat || chat.disabled) return;

    const image = getImageFromEvent(event);
    if (image === null) return;

    return showWarning ? warn(chat, image) : sendMessage(chat, image);
};


//============================\\
//       CHAT MANAGEMENT      \\
//============================\\


// toggle a spinner over the chat element
const toggleSpinner = (chatForm: HTMLFormElement, toggle: boolean): any => {
    const spinnerId = `${MODULE_NAME}-spinner`;
    const spinner = document.querySelector(`#${spinnerId}`);

    if (!toggle && spinner) return chatForm.removeChild(spinner);

    if (toggle && !spinner) {
        const newSpinner = document.createElement('DIV');
        newSpinner.setAttribute('id', spinnerId);
        chatForm.prepend(newSpinner);
    }
};

// toggles the spinner and disables the chat
const toggleChat = (chat: HTMLTextAreaElement) => (toggle: boolean) => (): any => {
    toggleSpinner(<HTMLFormElement>chat.parentNode, toggle);
    if (toggle) return chat.setAttribute('disabled', 'true');

    chat.removeAttribute('disabled');
    chat.focus();
};

// creates a new chat message with a given content, then calls cb if it's a function
const createChatMessage = (content: string, cb: Function): Promise<void> => ChatMessage.create({content}).then(() => typeof cb === 'function' && cb());

// handles the creation of a chat message from an url
const createMessageWithURL = (url: string, toggleChatFun: Function): Promise<void> => {
    toggleChatFun(true)();
    return createChatMessage(buildImageHTML({MODULE_NAME, url}), toggleChatFun(false));
}

// create a chat message with the image
const sendMessage = (chat: HTMLTextAreaElement, image: string | File): Promise<void> => {
    const toggleChatFun = toggleChat(chat);

    if (typeof image === 'string') {
        return createMessageWithURL(<string>image, toggleChatFun);
    }

};

// warn the user before creating a chat message
const warn = (chat: HTMLTextAreaElement, image: string | File): void => {
};

export {convertMessageToImage, createPopoutOnClick, handleChatInteraction};
