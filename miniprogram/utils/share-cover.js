function getImageInfo(src) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src,
      success: resolve,
      fail: reject
    });
  });
}

function downloadImageFile(src) {
  if (!/^https?:\/\//i.test(src) && !/^\/\//.test(src)) {
    return Promise.reject(new Error('source is not a remote image'));
  }

  const url = src.startsWith('//') ? `https:${src}` : src;
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode === 200 && res.tempFilePath) {
          resolve(res.tempFilePath);
          return;
        }
        reject(new Error(`download failed: ${res.statusCode || 'unknown'}`));
      },
      fail: reject
    });
  });
}

async function resolveImageSource(sourceUrl) {
  try {
    const imageInfo = await getImageInfo(sourceUrl);
    if (imageInfo?.path) {
      return {
        path: imageInfo.path,
        width: imageInfo.width,
        height: imageInfo.height
      };
    }
  } catch (error) {
    console.warn('share cover getImageInfo failed, trying download:', error);
  }

  try {
    const tempFilePath = await downloadImageFile(sourceUrl);
    const imageInfo = await getImageInfo(tempFilePath).catch(() => null);
    return {
      path: tempFilePath,
      width: imageInfo?.width || 0,
      height: imageInfo?.height || 0
    };
  } catch (error) {
    console.warn('share cover download failed, trying original source:', error);
  }

  return {
    path: sourceUrl,
    width: 0,
    height: 0
  };
}

function getCanvasNode(page, selector) {
  if (!wx.createSelectorQuery) {
    return Promise.reject(new Error('selector query is not supported'));
  }

  return new Promise((resolve, reject) => {
    const query = wx.createSelectorQuery();
    if (page && typeof query.in === 'function') {
      query.in(page);
    }

    query
      .select(selector)
      .fields({ node: true, size: true })
      .exec((result) => {
        const target = result && result[0];
        if (!target || !target.node) {
          reject(new Error(`canvas not found: ${selector}`));
          return;
        }
        resolve(target);
      });
  });
}

function loadCanvasImage(canvas, srcCandidates = []) {
  if (!canvas || typeof canvas.createImage !== 'function') {
    return Promise.reject(new Error('canvas image is not supported'));
  }

  const candidates = Array.isArray(srcCandidates)
    ? srcCandidates
    : [srcCandidates];
  let lastError = null;

  const tryLoad = async () => {
    for (const src of candidates) {
      if (!src) continue;
      try {
        const image = await new Promise((resolve, reject) => {
          const instance = canvas.createImage();
          instance.onload = () => resolve(instance);
          instance.onerror = (error) =>
            reject(error || new Error(`image load failed: ${src}`));
          instance.src = src;
        });
        return image;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('image load failed');
  };

  return tryLoad();
}

function drawImageAspect(ctx, image, imageWidth, imageHeight, box, mode = 'contain') {
  if (!ctx || !image || !imageWidth || !imageHeight || !box) {
    return;
  }

  const imageRatio = imageWidth / imageHeight;
  const boxRatio = box.width / box.height;

  if (mode === 'cover') {
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = imageWidth;
    let sourceHeight = imageHeight;

    if (imageRatio > boxRatio) {
      sourceWidth = imageHeight * boxRatio;
      sourceX = (imageWidth - sourceWidth) / 2;
    } else {
      sourceHeight = imageWidth / boxRatio;
      sourceY = (imageHeight - sourceHeight) / 2;
    }

    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      box.x,
      box.y,
      box.width,
      box.height
    );
    return;
  }

  const scale = Math.min(box.width / imageWidth, box.height / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const drawX = box.x + (box.width - drawWidth) / 2;
  const drawY = box.y + (box.height - drawHeight) / 2;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function exportCanvas(canvas, snapshot) {
  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas,
      width: snapshot.width,
      height: snapshot.height,
      destWidth: snapshot.destWidth || snapshot.width,
      destHeight: snapshot.destHeight || snapshot.height,
      fileType: snapshot.fileType || 'jpg',
      quality: snapshot.quality || 0.92,
      success: (res) => resolve(res.tempFilePath),
      fail: reject
    });
  });
}

async function createContainedShareCover(page, sourceUrl, options = {}) {
  if (!sourceUrl) {
    return '';
  }

  const snapshot = {
    width: options.width || 500,
    height: options.height || 400,
    fileType: options.fileType || 'jpg',
    quality: options.quality || 0.92
  };
  const selector = options.selector || '#shareCoverCanvas';
  const padding = Number.isFinite(options.padding) ? options.padding : 26;
  const backgroundAlpha = Number.isFinite(options.backgroundAlpha)
    ? options.backgroundAlpha
    : 0.28;
  const overlayFill = options.overlayFill || 'rgba(255, 255, 255, 0.66)';
  const backgroundFill = options.backgroundFill || '#f6f2ea';
  const imageSource = await resolveImageSource(sourceUrl);
  const target = await getCanvasNode(page, selector);
  const canvas = target.node;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(wx.getWindowInfo?.().pixelRatio || 2, 2);
  const imageCandidates = [imageSource.path];
  if (imageSource.path !== sourceUrl) {
    imageCandidates.push(sourceUrl);
  }
  const image = await loadCanvasImage(canvas, imageCandidates);
  const imageWidth = imageSource.width || image.width;
  const imageHeight = imageSource.height || image.height;

  if (!imageWidth || !imageHeight) {
    throw new Error('image size is unavailable');
  }

  canvas.width = snapshot.width * dpr;
  canvas.height = snapshot.height * dpr;

  if (typeof ctx.resetTransform === 'function') {
    ctx.resetTransform();
  } else if (typeof ctx.setTransform === 'function') {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, snapshot.width, snapshot.height);
  ctx.fillStyle = backgroundFill;
  ctx.fillRect(0, 0, snapshot.width, snapshot.height);

  ctx.save();
  ctx.globalAlpha = backgroundAlpha;
  drawImageAspect(ctx, image, imageWidth, imageHeight, {
    x: 0,
    y: 0,
    width: snapshot.width,
    height: snapshot.height
  }, 'cover');
  ctx.restore();

  ctx.save();
  ctx.fillStyle = overlayFill;
  ctx.fillRect(0, 0, snapshot.width, snapshot.height);
  ctx.restore();

  drawImageAspect(ctx, image, imageWidth, imageHeight, {
    x: padding,
    y: padding,
    width: snapshot.width - padding * 2,
    height: snapshot.height - padding * 2
  }, 'contain');

  return exportCanvas(canvas, snapshot);
}

module.exports = {
  createContainedShareCover
};
