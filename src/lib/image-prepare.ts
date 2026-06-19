import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

/** Matches lootopia-frontend `image-utils` upload compression defaults. */
export const MAX_UPLOAD_WIDTH = 1280;
export const MAX_UPLOAD_HEIGHT = 1280;
export const UPLOAD_JPEG_QUALITY = 0.82;

export type ImageDimensions = {
  width: number;
  height: number;
};

export function fitWithinMaxBox(
  width: number,
  height: number,
  maxWidth = MAX_UPLOAD_WIDTH,
  maxHeight = MAX_UPLOAD_HEIGHT
): ImageDimensions {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function getImageDimensions(uri: string): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });
}

function centerCropRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
) {
  const targetAspect = targetWidth / targetHeight;
  const sourceAspect = sourceWidth / sourceHeight;

  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;

  if (sourceAspect > targetAspect) {
    cropWidth = sourceHeight * targetAspect;
  } else {
    cropHeight = sourceWidth / targetAspect;
  }

  return {
    originX: Math.max(0, Math.round((sourceWidth - cropWidth) / 2)),
    originY: Math.max(0, Math.round((sourceHeight - cropHeight) / 2)),
    width: Math.max(1, Math.round(cropWidth)),
    height: Math.max(1, Math.round(cropHeight)),
  };
}

async function saveAsJpeg(uri: string, width: number, height: number): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width, height } }],
    { compress: UPLOAD_JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

/** Compress like the web image picker (max 1280×1280, preserve aspect ratio). */
export async function compressImageForUpload(uri: string): Promise<string> {
  const { width, height } = await getImageDimensions(uri);
  const target = fitWithinMaxBox(width, height);
  if (target.width === width && target.height === height) {
    const result = await ImageManipulator.manipulateAsync(uri, [], {
      compress: UPLOAD_JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return result.uri;
  }
  return saveAsJpeg(uri, target.width, target.height);
}

/** Center-crop then resize so the capture matches the stored reference dimensions. */
export async function prepareCapturedPhotoToMatchReference(
  capturedUri: string,
  reference: ImageDimensions
): Promise<string> {
  // Web reference images are uploaded without cropping: they are scaled down to fit
  // inside a bounding box (preserving aspect ratio).
  // Cropping can remove important clue pixels and hurt the server recognition.
  //
  // We therefore replicate the same behavior, but we use the server reference
  // dimensions as the bounding box.
  const { width: sourceWidth, height: sourceHeight } = await getImageDimensions(capturedUri);
  const target = fitWithinMaxBox(sourceWidth, sourceHeight, reference.width, reference.height);

  const result = await ImageManipulator.manipulateAsync(
    capturedUri,
    [{ resize: { width: target.width, height: target.height } }],
    { compress: UPLOAD_JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
  );

  return result.uri;
}

export async function prepareStepPhotoForUpload(
  capturedUri: string,
  reference?: ImageDimensions | null
): Promise<string> {
  if (reference && reference.width > 0 && reference.height > 0) {
    return prepareCapturedPhotoToMatchReference(capturedUri, reference);
  }
  return compressImageForUpload(capturedUri);
}
