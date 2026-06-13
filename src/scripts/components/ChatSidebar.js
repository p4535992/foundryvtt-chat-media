import { find, on } from "../utils/JqueryWrappers.js";
import { getImageQueue, processDropAndPasteImages, removeAllFromQueue } from "../processors/FileProcessor.js";
import { i18n } from "../utils/Utils.js";
import { getUploadingStates } from "./Loader.js";
import { getSetting } from "../utils/Settings.js";

let hookIsHandlingTheMessage = false;
let eventIsHandlingTheMessage = false;
let processingDropOrPaste = false;

const imageTemplate = (imageProps) => {
  const isVideo = imageProps.type && imageProps.type.startsWith("video/");

  if (isVideo) {
    // Get settings for video attributes
    const autoplay = getSetting("videoAutoplay");
    const loop = getSetting("videoLoop");
    const muted = getSetting("videoMuted");
    const controls = getSetting("videoControls");

    return `<div class="chat-media-image">
  <video class="chat-media-video" data-src="${imageProps.imageSrc}" src="${imageProps.imageSrc}"${autoplay ? " autoplay" : ""}${loop ? " loop" : ""}${muted ? " muted" : ""}${controls ? " controls" : ""}>
    <source src="${imageProps.imageSrc}" type="${imageProps.type}">
  </video></div>`;
  } else {
    return `<div class="chat-media-image">
  <img data-src="${imageProps.imageSrc}" src="${imageProps.imageSrc}" alt="${
    imageProps.name || i18n("unableToLoadImage")
  }" /></div>`;
  }
};

const messageTemplate = (imageQueue) => {
  const imageTemplates = imageQueue.map((imageProps) => imageTemplate(imageProps));
  return `<div class="chat-media-message">${imageTemplates.join("")}</div>`;
};

export const preCreateChatMessageHandler = (sidebar) => (chatMessage, userOptions, messageOptions) => {
  if (eventIsHandlingTheMessage) return;

  hookIsHandlingTheMessage = true;
  const imageQueue = getImageQueue();
  if (!imageQueue.length) {
    hookIsHandlingTheMessage = false;
    return;
  }

  const uploadState = getUploadingStates(sidebar);
  uploadState.on();

  const content = `${messageTemplate(imageQueue)}<div class="chat-media-notes">${chatMessage.content}</div>`;

  chatMessage.content = content;
  chatMessage._source.content = content;
  messageOptions.chatBubble = false;

  removeAllFromQueue(sidebar);
  hookIsHandlingTheMessage = false;
  uploadState.off();
};

const emptyChatEventHandler = (sidebar) => async (evt) => {
  if (hookIsHandlingTheMessage || (evt.code !== "Enter" && evt.code !== "NumpadEnter") || evt.shiftKey) return;
  eventIsHandlingTheMessage = true;

  const uploadState = getUploadingStates(sidebar);
  const imageQueue = getImageQueue();
  if (!imageQueue.length) {
    eventIsHandlingTheMessage = false;
    return;
  }
  uploadState.on();

  const messageData = {
    content: messageTemplate(imageQueue),
    style: CONST.CHAT_MESSAGE_STYLES?.OOC || CONST.CHAT_MESSAGE_TYPES?.OOC || 1,
    user: game.user,
  };
  await ChatMessage.create(messageData);
  removeAllFromQueue(sidebar);
  uploadState.off();
  eventIsHandlingTheMessage = false;
};

const pastAndDropEventHandler = (sidebar) => async (evt) => {
  // Prevent duplicate processing
  if (processingDropOrPaste) {
    console.log("Chat Media: Event already being processed, ignoring duplicate");
    return;
  }

  processingDropOrPaste = true;
  console.log("Chat Media: Paste/Drop event triggered", evt.type, evt);

  try {
    // Handle both jQuery events and native events
    const originalEvent = evt.originalEvent || evt;
    const eventData = originalEvent.clipboardData || originalEvent.dataTransfer;

    console.log("Chat Media: Event data", { originalEvent, eventData });

    if (!eventData) {
      console.log("Chat Media: No event data found");
      return;
    }

    // Prevent default behavior for drop events
    if (originalEvent.type === "drop") {
      originalEvent.preventDefault();
      originalEvent.stopPropagation();
    }

    await processDropAndPasteImages(eventData, sidebar);
  } finally {
    processingDropOrPaste = false;
  }
};

export const initChatSidebar = (sidebar) => {
  Hooks.on("preCreateChatMessage", preCreateChatMessageHandler(sidebar));

  console.log("Chat Media: Initializing ChatSidebar", { sidebar });

  let chatMessage = null;
  const sidebarElement = sidebar[0] || sidebar;
  const textArea = sidebarElement.querySelector ? sidebarElement.querySelector("#chat-message") : null;
  if (textArea) {
    chatMessage = $(textArea); // Wrap in jQuery for consistency
  }

  if (chatMessage && chatMessage[0]) {
    console.log("Chat Media: Found chat message element, attaching events");

    const textAreaElement = chatMessage[0];

    // Use only jQuery for keyup events (this works fine)
    on(chatMessage, "keyup", emptyChatEventHandler(sidebar));

    // Use only native DOM events for drag/drop/paste to avoid duplicates
    if (textAreaElement) {
      textAreaElement.addEventListener("paste", (evt) => {
        console.log("Chat Media: Native paste event", evt);
        pastAndDropEventHandler(sidebar)({ originalEvent: evt });
      });

      textAreaElement.addEventListener("drop", (evt) => {
        console.log("Chat Media: Native drop event", evt);
        evt.preventDefault();
        pastAndDropEventHandler(sidebar)({ originalEvent: evt });
      });

      textAreaElement.addEventListener("dragover", (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
      });

      textAreaElement.addEventListener("dragenter", (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
      });
    }
  } else {
    console.warn("Chat Media: Could not find #chat-message element for drag/drop functionality");
    // Try to find it with a more specific selector
    const chatMessageFallback = sidebar.find ? sidebar.find("#chat-message") : $(sidebar).find("#chat-message");
    console.log("Chat Media: Fallback search result:", chatMessageFallback);
  }
};
