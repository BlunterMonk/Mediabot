import ThumbnailGenerator from 'video-thumbnail-generator';
import * as fs from 'fs';

const gifOptions = {
    fps: 0.75, // how many frames per second you want in your gif
    scale: 180, // the smaller the number, the smaller the thumbnail
    speedMultiple: 2, // this is 4x speed
    deletePalette: true // to delete the palettefile that was generated to create the gif once gif is created 
};

export function generateThumb(videoPath: string, thumbPath: string, id: string): Promise<string> {
    if (!fs.existsSync(videoPath))
        return Promise.reject("File does not exist");

    const tg = new ThumbnailGenerator({
        sourcePath: videoPath,
        thumbnailPath: thumbPath,
        tmpDir: './tempgifs/' //only required if you can't write to /tmp/ and you need to generate gifs
    });

    return tg.generateOneByPercent(10, {
        size: '1280x720',
        filename: `thumb_${id}.jpg`
    });
}

export function generateGif(videoPath: string): Promise<string> {
    if (!fs.existsSync(videoPath))
        return Promise.reject("File does not exist");
        
    const tg = new ThumbnailGenerator({
        sourcePath: videoPath,
        thumbnailPath: './temp/',
        tmpDir: './tempgifs/' //only required if you can't write to /tmp/ and you need to generate gifs
    });
    
    return tg.generateGif(gifOptions);
}