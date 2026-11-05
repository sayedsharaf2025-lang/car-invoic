import { scanDocument, createCornerEditor, extractDocument } from 'scanic';
import imageCompression from 'browser-image-compression';
window.Scanic = { scanDocument, createCornerEditor, extractDocument };
window.imageCompression = imageCompression;
