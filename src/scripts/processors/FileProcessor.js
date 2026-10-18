import { ORIGIN_FOLDER, randomString, i18n, userCanUpload } from "../utils/Utils.js";
import { addClass, append, create, find, on, remove, removeClass } from "../utils/JqueryWrappers.js";
import imageCompression from "../browser-image-compression/browser-image-compression.mjs";
import { getUploadingStates } from "../components/Loader.js";
import { getSetting } from "../utils/Settings.js";

// export const SaveValueType = {
// 	type = "";
// 	name = "";
// 	file = new File;
// 	imageSrc | ArrayBuffer;
// 	id;
// };

const RESTRICTED_DOMAINS = ["static.wikia"];

const DOM_PARSER = new DOMParser();

let imageQueue = [];

const isFileImage = (file) => {
  // Handle both File objects and DataTransferItem objects
  const type = file.type || (file.kind === "file" && file.type);
  const name = file.name || "";
  const extension = name.substring(name.lastIndexOf(".")).toLowerCase();

  // Check by file extension for images
  const imageExtensions = [".apng", ".avif", ".bmp", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".tiff", ".webp"];
  return imageExtensions.includes(extension);
};

const isFileVideo = (file) => {
  // Handle both File objects and DataTransferItem objects
  const type = file.type || (file.kind === "file" && file.type);
  const name = file.name || "";
  const extension = name.substring(name.lastIndexOf(".")).toLowerCase();

  // Check by file extension for videos
  const videoExtensions = [".webm", ".m4v", ".mp4", ".ogv"];
  return videoExtensions.includes(extension);
};

// Ideas for the future?
// const isFileAudio = (file) => {
//     // Handle both File objects and DataTransferItem objects
//     const type = file.type || (file.kind === "file" && file.type);
//     const name = file.name || "";
//     const extension = name.substring(name.lastIndexOf(".")).toLowerCase();

//     // Check by file extension for audio
//     const audioExtensions = [".aac", ".flac", ".m4a", ".mid", ".mp3", ".ogg", ".opus", ".wav"];
//     return audioExtensions.includes(extension);
// };

// const isFileDocument = (file) => {
//     const name = file.name || "";
//     const extension = name.substring(name.lastIndexOf(".")).toLowerCase();

//     // Check by file extension for documents
//     const documentExtensions = [".csv", ".json", ".md", ".pdf", ".tsv", ".txt", ".xml", ".yml", ".yaml"];
//     return documentExtensions.includes(extension);
// };

// const isFileFont = (file) => {
//     const name = file.name || "";
//     const extension = name.substring(name.lastIndexOf(".")).toLowerCase();

//     // Check by file extension for fonts
//     const fontExtensions = [".otf", ".ttf", ".woff", ".woff2"];
//     return fontExtensions.includes(extension);
// };

// const isFile3D = (file) => {
//     const name = file.name || "";
//     const extension = name.substring(name.lastIndexOf(".")).toLowerCase();

//     // Check by file extension for 3D models
//     const modelExtensions = [".fbx", ".glb", ".gltf", ".mtl", ".obj", ".stl", ".usdz"];
//     return modelExtensions.includes(extension);
// };

const isAllowedFile = (file) => {
  return isFileImage(file) || isFileVideo(file);
  // return isFileImage(file) || isFileVideo(file) || isFileAudio(file) || isFileDocument(file) || isFileFont(file) || isFile3D(file);
};

const createMediaPreview = ({ imageSrc, id, type }) => {
  const isVideo = type && type.startsWith("video/");

  if (isVideo) {
    // Get settings for video attributes
    const autoplay = getSetting("videoAutoplay");
    const loop = getSetting("videoLoop");
    const muted = getSetting("videoMuted");
    const controls = getSetting("videoControls");

    return create(
      `<div id="${id}" class="chat-media-upload-area-image">
                <i class="chat-media-remove-image-icon fa-regular fa-circle-xmark"></i>
                <video class="chat-media-image-preview" data-src="${imageSrc}" src="${imageSrc}"${autoplay ? " autoplay" : ""}${loop ? " loop" : ""}${muted ? " muted" : ""}${controls ? " controls" : ""}>
                    <source src="${imageSrc}" type="${type}">
                </video>
            </div>`,
    );
  } else {
    return create(
      `<div id="${id}" class="chat-media-upload-area-image">
                <i class="chat-media-remove-image-icon fa-regular fa-circle-xmark"></i>
                <img class="chat-media-image-preview" data-src="${imageSrc}" src="${imageSrc}" alt="${i18n(
                  "unableToLoadImage",
                )}"/>
            </div>`,
    );
  }
};

const addEventToRemoveButton = (removeButton, saveValue, uploadArea) => {
  const removeEventHandler = () => {
    const image = find(`#${saveValue.id}`, uploadArea);

    remove(image);
    imageQueue = imageQueue.filter((imgData) => saveValue.id !== imgData.id);

    if (imageQueue.length) return;
    addClass(uploadArea, "hidden");
  };
  on(removeButton, "click", removeEventHandler);
};

const uploadFile = async (saveValue) => {
  const generateFileName = (saveValue) => {
    const { type, name, id } = saveValue;
    let fileExtension = name?.substring(name.lastIndexOf("."), name.length);

    if (!fileExtension) {
      if (type?.startsWith("image/")) {
        fileExtension = type.replace("image/", ".") || ".jpeg";
      } else if (type?.startsWith("video/")) {
        fileExtension = type.replace("video/", ".") || ".mp4";
      } else {
        throw new Error("Unsupported file type for upload");
      }
    }

    return `${id}${fileExtension}`;
  };

  try {
    const newName = generateFileName(saveValue);
    let fileToUpload;

    // Only compress raster images (exclude GIFs and SVGs), upload videos, GIFs, and SVGs directly
    if (saveValue.type?.startsWith("image/") && saveValue.type !== "image/gif" && saveValue.type !== "image/svg+xml") {
      const compressedImage = await imageCompression(saveValue.file, {
        maxSizeMB: 1.5,
        useWebWorker: true,
        alwaysKeepResolution: true,
      });
      fileToUpload = new File([compressedImage], newName, { type: saveValue.type });
    } else {
      // For videos, GIFs, SVGs, and other files, upload directly to preserve animation/quality/vector graphics
      fileToUpload = new File([saveValue.file], newName, { type: saveValue.type });
    }

    const uploadLocation = getSetting("uploadLocation");

    const FilePickerImpl = foundry.applications?.apps?.FilePicker?.implementation || FilePicker;
    const fileLocation = await FilePickerImpl.upload(
      ORIGIN_FOLDER,
      uploadLocation,
      fileToUpload,
      {},
      { notify: false },
    );

    if (!fileLocation || !fileLocation.path) return saveValue.imageSrc;
    return fileLocation.path;
  } catch (e) {
    console.error("Chat Media: Error uploading file:", e);
    return saveValue.imageSrc;
  }
};

const addImageToQueue = async (saveValue, sidebar) => {
  const uploadingStates = getUploadingStates(sidebar);

  uploadingStates.on();
  const uploadArea = find("#chat-media-chat-upload-area", sidebar);
  if (!uploadArea || !uploadArea[0]) return;

  if (saveValue.file) {
    if (!userCanUpload()) {
      uploadingStates.off();
      return;
    }
    saveValue.imageSrc = await uploadFile(saveValue);
  }

  const imagePreview = createMediaPreview(saveValue);
  if (!imagePreview || !imagePreview[0]) return;

  removeClass(uploadArea, "hidden");
  append(uploadArea, imagePreview);
  imageQueue.push(saveValue);

  const removeButton = find(".chat-media-remove-image-icon", imagePreview);
  addEventToRemoveButton(removeButton, saveValue, uploadArea);
  uploadingStates.off();
};

const filesFileReaderHandler = (file, sidebar) => async (evt) => {
  const imageSrc = evt.target?.result;
  const saveValue = { type: file.type, name: file.name, imageSrc: imageSrc, id: randomString(), file: file };
  await addImageToQueue(saveValue, sidebar);
};

export const processFiles = (files, sidebar) => {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    // Check if file is allowed
    if (!isAllowedFile(file)) {
      console.warn(`Chat Media: File type not allowed: ${file.name}`);
      continue;
    }

    const reader = new FileReader();
    reader.addEventListener("load", filesFileReaderHandler(file, sidebar));
    reader.readAsDataURL(file);
  }
};

export const processDropAndPasteImages = async (eventData, sidebar) => {
  console.log("Chat Media: processDropAndPasteImages called", { eventData, sidebar });

  if (!eventData) {
    console.log("Chat Media: No eventData provided");
    return;
  }

  const extractUrlFromEventData = (eventData) => {
    try {
      const html = eventData.getData("text/html");
      console.log("Chat Media: HTML data from event:", html);
      if (!html) return null;

      const images = DOM_PARSER.parseFromString(html, "text/html").querySelectorAll("img");
      if (!images || !images.length) return null;

      const imageUrls = [...images].map((img) => img.src);
      const imagesContainRestrictedDomains = imageUrls.some((iu) => RESTRICTED_DOMAINS.some((rd) => iu.includes(rd)));
      console.log("Chat Media: Found image URLs:", imageUrls, "Restricted:", imagesContainRestrictedDomains);
      return imagesContainRestrictedDomains ? null : imageUrls;
    } catch (error) {
      console.log("Chat Media: Error extracting URL from event data:", error);
      return null;
    }
  };

  const urlsFromEventDataHandler = async (urls) => {
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const saveValue = { imageSrc: url, id: randomString() };
      // Try to fetch the image so it is uploaded and served by Foundry like any other
      // file; if the remote host blocks it (e.g. CORS), keep linking the URL as before.
      try {
        if (/^(https?:|blob:|data:)/.test(url) && !url.startsWith(window.location.origin)) {
          const res = await fetch(url);
          const blob = res.ok ? await res.blob() : null;
          if (blob && /^(image|video)\//.test(blob.type)) {
            const extension = blob.type.split("/")[1].split("+")[0];
            saveValue.type = blob.type;
            saveValue.file = new File([blob], `${saveValue.id}.${extension}`, { type: blob.type });
          }
        }
      } catch (error) {
        console.warn("Chat Media: Could not fetch image to upload, linking URL instead", url, error);
      }
      await addImageToQueue(saveValue, sidebar);
    }
  };

  const extractFilesFromEventData = (eventData) => {
    console.log("Chat Media: Extracting files from event data", eventData);

    // Check if items exist
    if (!eventData.items) {
      console.log("Chat Media: No items in event data");
      return [];
    }

    const items = eventData.items;
    console.log("Chat Media: Event data items:", items, "Length:", items.length);
    const files = [];

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        console.log("Chat Media: Processing item:", item, "Kind:", item.kind, "Type:", item.type);

        // Check if it's a file
        if (item.kind !== "file") {
          console.log("Chat Media: Item is not a file, skipping");
          continue;
        }

        const file = item.getAsFile();
        console.log("Chat Media: Got file:", file);

        if (!file) {
          console.log("Chat Media: Could not get file from item");
          continue;
        }

        if (!isAllowedFile(file)) {
          console.log("Chat Media: File type not allowed, skipping");
          continue;
        }

        files.push(file);
      }
    } catch (error) {
      console.error("Chat Media: Error processing event data items:", error);
    }

    console.log("Chat Media: Final files array:", files);
    return files;
  };

  const filesExtracted = extractFilesFromEventData(eventData);
  if (filesExtracted && filesExtracted.length) {
    console.log("Chat Media: Processing files:", filesExtracted);
    return await processFiles(filesExtracted, sidebar);
  }

  // Only fall back to <img> URLs from the HTML payload when no actual file was provided.
  // Copying an image in a browser puts both the file and an <img src> pointing at the
  // original URL on the clipboard; that URL is often private (signed, session or cookie
  // bound) and shows as a broken image for every other user.
  const urls = extractUrlFromEventData(eventData);
  if (urls && urls.length) {
    console.log("Chat Media: Processing URLs:", urls);
    return await urlsFromEventDataHandler(urls);
  }

  console.log("Chat Media: No files or URLs found to process");
};

export const getImageQueue = () => imageQueue;

export const removeAllFromQueue = (sidebar) => {
  while (imageQueue.length) {
    const imageData = imageQueue.pop();
    if (!imageData) continue;

    const imageElement = find(`#${imageData.id}`, sidebar);
    remove(imageElement);
  }

  const uploadArea = find("#chat-media-chat-upload-area", sidebar);
  addClass(uploadArea, "hidden");
};
