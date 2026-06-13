/* eslint-disable indent */
/* eslint-disable require-jsdoc */
/* eslint-disable no-tabs */

import { getVideoType } from "../lib/lib.js";
import { i18n } from "../utils/Utils.js";
import { getSetting } from "../utils/Settings.js";

/*
 * Cautious Gamemasters Pack
 * https://github.com/cs96and/FoundryVTT-CGMP
 *
 * Copyright (c) 2020 Shoyu Vanilla - All Rights Reserved.
 * Copyright (c) 2021-2022 Alan Davies - All Rights Reserved.
 *
 * You may use, distribute and modify this code under the terms of the MIT license.
 *
 * You should have received a copy of the MIT license with this file. If not, please visit:
 * https://mit-license.org/
 */
export class ChatResolver {
  static PATTERNS = {
    // extended commands
    // "cimage": /^(\/cimage\s+)(\([^\)]+\)|\[[^\]]+\]|"[^"]+"|'[^']+'|[^\s]+)\s+([^]*)/i,
    // desc regex contains an empty group so that the match layout is the same as "as"
    // cimage: /^(\/cimage\s+)()([^]*)/i,
    cimage: /^(cimage\s+)()([^]*)/i,
    cvideo: /^(cvideo\s+)()([^]*)/i,
  };

  static _REPLACE_PATTERNS = {
    cimage: /(cimage\s*)/gi,
    cvideo: /(cvideo\s*)/gi,
  };

  static imageReg = /https?:\/\/[^\s]+\.(apng|avif|bmp|gif|jpeg|jpg|png|svg|tiff|webp)(\?[^\s]*)?/gi;
  static imageRegBase64 = /(data:image\/[^;]+;base64[^"]+)/gi;
  static imageMarkdownReg = /^(cimage\s+)\s*(.+?)\s*/gi;

  static videoReg = /https?:\/\/[^\s]+\.(webm|m4v|mp4|ogv)(\?[^\s]*)?/gi;
  static videoRegBase64 = /(data:video\/[^;]+;base64[^"]+)/gi;
  static videoMarkdownReg = /^(cvideo\s+)\s*(.+?)\s*/gi;

  static CHAT_MESSAGE_SUB_TYPES = {
    CIMAGE: 0,
    CVIDEO: 1,
  };

  static onChatMessage(chatLog, message, chatData) {
    // Parse the message to determine the matching handler
    const [command, match] = ChatResolver._parseChatMessage(message);

    // Process message data based on the identified command type
    switch (command) {
      case "cimage": {
        if (!game.user?.isGM) {
          // TODO add game setting for allow player or only the gm
          return true;
        }

        // Remove quotes or brackets around the speaker's name.
        const alias = match[2].replace(/^["'\(\[](.*?)["'\)\]]$/, "$1");

        const newMessage = message.replaceAll(ChatResolver._REPLACE_PATTERNS.cimage, "");
        // split by one or more whitespace characters regex - \s+
        const imagesToCheck = newMessage.split(/\s+/);
        const images = [];
        for (const src of imagesToCheck) {
          // Remove quotes or brackets around the src url
          let srcCleaned = src;
          srcCleaned = srcCleaned.replaceAll('data-src="', "");
          srcCleaned = srcCleaned.replaceAll('src="', "");
          srcCleaned = srcCleaned.replace(/^["'\(\[](.*?)["'\)\]]$/, "$1");
          if (srcCleaned.match(ChatResolver.imageReg) || srcCleaned.match(ChatResolver.imageRegBase64)) {
            if (!images.includes(srcCleaned) && !srcCleaned.includes("alt=")) {
              images.push(srcCleaned);
            }
          }
        }

        chatData.flags ??= {};
        chatData.flags["chat-media"] = {
          urls: images.toString(),
          subType: ChatResolver.CHAT_MESSAGE_SUB_TYPES.CIMAGE,
        };

        chatData.style = CONST.CHAT_MESSAGE_STYLES?.IC || CONST.CHAT_MESSAGE_TYPES?.IC;
        chatData.speaker = { alias: alias, scene: game.user.viewedScene };
        chatData.content = match[3].replace(/\n/g, "<br>");
        // Fall through...

        return true;
      }
      case "cvideo": {
        if (!game.user?.isGM) {
          // TODO add game setting for allow player or only the gm
          return true;
        }

        // Remove quotes or brackets around the speaker's name.
        const alias = match[2].replace(/^["'\(\[](.*?)["'\)\]]$/, "$1");

        const newMessage = message.replaceAll(ChatResolver._REPLACE_PATTERNS.cvideo, "");
        // split by one or more whitespace characters regex - \s+
        const videosToCheck = newMessage.split(/\s+/);
        const videos = [];
        for (const src of videosToCheck) {
          // Remove quotes or brackets around the src url
          let srcCleaned = src;
          srcCleaned = srcCleaned.replaceAll('data-src="', "");
          srcCleaned = srcCleaned.replaceAll('src="', "");
          srcCleaned = srcCleaned.replace(/^["'\(\[](.*?)["'\)\]]$/, "$1");
          if (srcCleaned.match(ChatResolver.videoReg) || srcCleaned.match(ChatResolver.videoRegBase64)) {
            if (!videos.includes(srcCleaned) && !srcCleaned.includes("alt=")) {
              videos.push(srcCleaned);
            }
          }
        }

        chatData.flags ??= {};
        chatData.flags["chat-media"] = {
          urls: videos.toString(),
          subType: ChatResolver.CHAT_MESSAGE_SUB_TYPES.CVIDEO,
        };

        chatData.style = CONST.CHAT_MESSAGE_STYLES?.IC || CONST.CHAT_MESSAGE_TYPES?.IC;
        chatData.speaker = { alias: alias, scene: game.user.viewedScene };
        chatData.content = match[3].replace(/\n/g, "<br>");
        // Fall through...

        return true;
      }
      default: {
        return true;
      }
    }
  }

  static onPreCreateChatMessage(chatMessage, messageB, messageOptions) {
    if (!messageB) {
      return;
    }
    const messageData = messageB;
    const message = messageB.content ? messageB.content : messageB;

    if (!messageData) {
      return message;
    }
    if (!messageData.flags) {
      return message;
    }
    switch (messageData.flags["chat-media"]?.subType) {
      case ChatResolver.CHAT_MESSAGE_SUB_TYPES.CIMAGE: {
        const messageTmp = message.startsWith("cimage") ? message : "cimage " + message;
        if (!messageTmp.match(ChatResolver.PATTERNS.cimage)) {
          return message;
        }
        const processedMessage = ChatResolver._processMessageImage(messageTmp);
        chatMessage.content = processedMessage;
        chatMessage._source.content = processedMessage;
        messageOptions.chatBubble = false;
        return processedMessage;
      }
      case ChatResolver.CHAT_MESSAGE_SUB_TYPES.CVIDEO: {
        const messageTmp = message.startsWith("cvideo") ? message : "cvideo " + message;
        if (!messageTmp.match(ChatResolver.PATTERNS.cvideo)) {
          return message;
        }
        const processedMessage = ChatResolver._processMessageVideo(messageTmp);
        chatMessage.content = processedMessage;
        chatMessage._source.content = processedMessage;
        messageOptions.chatBubble = false;
        return processedMessage;
      }
      default: {
        break;
      }
    }
    return message;
  }

  static _processMessageImage(message) {
    if (!message.match(ChatResolver.imageMarkdownReg)) {
      return message;
    }
    const newMessage = message.replaceAll(ChatResolver._REPLACE_PATTERNS.cimage, "");
    // split by one or more whitespace characters regex - \s+
    const imagesToCheck = newMessage.split(/\s+/);
    const images = [];
    for (const src of imagesToCheck) {
      // Remove quotes or brackets around the src url
      let srcCleaned = src;
      srcCleaned = srcCleaned.replaceAll('data-src="', "");
      srcCleaned = srcCleaned.replaceAll('src="', "");
      srcCleaned = srcCleaned.replace(/^["'\(\[](.*?)["'\)\]]$/, "$1");
      if (srcCleaned.match(ChatResolver.imageReg) || srcCleaned.match(ChatResolver.imageRegBase64)) {
        if (!images.includes(srcCleaned) && !srcCleaned.includes("alt=")) {
          images.push(srcCleaned);
        }
      }
    }
    if (images?.length <= 0) {
      return message;
    }
    let imageTemplate = ``;
    for (const src of images) {
      imageTemplate =
        imageTemplate +
        `<div class="chat-media-image">
					<img data-src="${src}" src="${src}" alt="${i18n("unableToLoadImage")}" />
			</div>`;
    }
    return imageTemplate;
  }

  static _processMessageVideo(message) {
    if (!message.match(ChatResolver.videoMarkdownReg)) {
      return message;
    }

    // Get settings for video attributes
    const autoplay = getSetting("videoAutoplay");
    const loop = getSetting("videoLoop");
    const muted = getSetting("videoMuted");
    const controls = getSetting("videoControls");

    const newMessage = message.replaceAll(ChatResolver._REPLACE_PATTERNS.cvideo, "");
    // split by one or more whitespace characters regex - \s+
    const videosToCheck = newMessage.split(/\s+/);
    const videos = [];
    for (const src of videosToCheck) {
      // Remove quotes or brackets around the src url
      let srcCleaned = src;
      srcCleaned = srcCleaned.replaceAll('data-src="', "");
      srcCleaned = srcCleaned.replaceAll('src="', "");
      srcCleaned = srcCleaned.replace(/^["'\(\[](.*?)["'\)\]]$/, "$1");
      if (srcCleaned.match(ChatResolver.videoReg) || srcCleaned.match(ChatResolver.videoRegBase64)) {
        if (!videos.includes(srcCleaned) && !srcCleaned.includes("alt=")) {
          videos.push(srcCleaned);
        }
      }
    }
    if (videos?.length <= 0) {
      return message;
    }
    let videoTemplate = ``;
    for (const src of videos) {
      videoTemplate =
        videoTemplate +
        `<div class="chat-media-image">
				<video class="chat-media-video" data-src="${src}" src="${src}"${autoplay ? " autoplay" : ""}${loop ? " loop" : ""}${muted ? " muted" : ""}${controls ? " controls" : ""}>
				<source src="${src}" type="${getVideoType(src)}">
			</video>
			</div>`;
    }
    return videoTemplate;
  }

  static onRenderChatMessageHTML(chatMessage, html, messageData) {
    if (!messageData.message.flags) {
      if (
        chatMessage?.content &&
        (chatMessage?.content.startsWith("cimage") || chatMessage?.content.startsWith("cvideo")) &&
        html.querySelector(".chat-media-image")
      ) {
        messageData.message.flags ??= {};
        messageData.message.flags["chat-media"] = { subType: ChatResolver.CHAT_MESSAGE_SUB_TYPES.CIMAGE };

        messageData.message.style = CONST.CHAT_MESSAGE_STYLES?.IC || CONST.CHAT_MESSAGE_TYPES?.IC;
      }
    }

    switch (messageData.message.flags["chat-media"]?.subType) {
      case ChatResolver.CHAT_MESSAGE_SUB_TYPES.CIMAGE: {
        html.classList.add("chat-media-image");
        return;
      }
      case ChatResolver.CHAT_MESSAGE_SUB_TYPES.CVIDEO: {
        html.classList.add("chat-media-image");
        return;
      }
      default: {
        break;
      }
    }
  }

  static onRenderChatMessage(chatMessage, html, messageData) {
    if (!messageData.message.flags) {
      if (
        chatMessage?.content &&
        (chatMessage?.content.startsWith("cimage") || chatMessage?.content.startsWith("cvideo")) &&
        $(chatMessage.content).find(".chat-media-image")
      ) {
        messageData.message.flags ??= {};
        messageData.message.flags["chat-media"] = { subType: ChatResolver.CHAT_MESSAGE_SUB_TYPES.CIMAGE };

        messageData.message.style = CONST.CHAT_MESSAGE_STYLES?.IC || CONST.CHAT_MESSAGE_TYPES?.IC;
      }
    }

    switch (messageData.message.flags["chat-media"]?.subType) {
      case ChatResolver.CHAT_MESSAGE_SUB_TYPES.CIMAGE: {
        html.addClass("chat-media-image");
        return;
      }
      case ChatResolver.CHAT_MESSAGE_SUB_TYPES.CVIDEO: {
        html.addClass("chat-media-image");
        return;
      }
      default: {
        break;
      }
    }
  }

  /**
   * The set of commands that can be processed over multiple lines.
   * @type {Set<string>}
   */
  static MULTILINE_COMMANDS = new Set(["roll", "gmroll", "blindroll", "selfroll", "publicroll"]);

  static _parseChatMessage(message) {
    // Iterate over patterns, finding the first match
    // for ( const [command, rgx] of Object.entries(ChatResolver.PATTERNS) ) {
    //   const match = message.match(rgx)
    //   if (match) {
    //     return [command, match]
    //   }
    // }
    // return [undefined, undefined]
    if (!message) {
      return message;
    }
    for (const [rule, rgx] of Object.entries(ChatResolver.PATTERNS)) {
      // For multi-line matches, the first line must match
      if (this.MULTILINE_COMMANDS.has(rule)) {
        const lines = message.split("\n");
        if (rgx.test(lines[0])) {
          return [rule, lines.map((l) => l.match(rgx))];
        }
      }
      // For single-line matches, match directly
      else {
        const match = message.match(rgx);
        if (match) return [rule, match];
      }
    }
    return ["none", [message, "", message]];
  }
}
