const axios = require('axios');
const FormData = require('form-data');
const logger = require('../utils/logger');
const { storeMagnet, getAllMagnets, deleteMagnet } = require('../utils/db');

let cleanupTimeout = null;

// Schedule cleanup of old magnets
function scheduleCleanup(config, delayMs = 1 * 60 * 1000) {
  if (cleanupTimeout) clearTimeout(cleanupTimeout);
  cleanupTimeout = setTimeout(() => {
    cleanupOldMagnets(config);
  }, delayMs);
}

// Upload magnets to AllDebrid
async function uploadMagnets(magnets, config) {
  const url = `https://api.alldebrid.com/v4/magnet/upload?apikey=${config.API_KEY_ALLEDBRID}`;
  
  // Extract hashes from the magnets parameter
  const hashes = magnets.map(m => m.hash);
  const formData = new FormData();
  hashes.forEach(hash => formData.append("magnets[]", hash));

  try {
    logger.info("🔄 Uploading magnets...");
    const response = await axios.post(url, formData, {
      headers: {
        "Authorization": `Bearer ${config.API_KEY_ALLEDBRID}`,
        ...formData.getHeaders()
      }
    });

    if (response.data.status === "success") {
      logger.info(`✅ Successfully uploaded ${response.data.data.magnets.length} magnets.`);
      logger.debug(JSON.stringify(response.data, null, 2));
      scheduleCleanup(config);
      for (const magnet of response.data.data.magnets) {
        await storeMagnet(magnet.id, magnet.hash, magnet.name);
      }
      return response.data.data.magnets.map(magnet => ({
        hash: magnet.hash,
        ready: magnet.ready ? '✅ Ready' : '❌ Not ready',
        name: magnet.name,
        size: magnet.size,
        id: magnet.id,
        source: magnets.find(m => m.hash === magnet.hash)?.source || "Unknown"
      }));
    } else {
      // Log status, error code and message if present
      const { status, error } = response.data;
      if (error && error.code && error.message) {
        logger.error(`❌ Error uploading magnets: status=${status}, code=${error.code}, message=${error.message}`);
      } else {
        logger.warn(`❌ Error uploading magnets: ${JSON.stringify(response.data, null, 2)}`);
      }
      scheduleCleanup(config);
      return [];
    }
  } catch (error) {
    logger.error("❌ Upload error:", error.response?.data || error.message);
    logger.debug("AllDebrid upload error full response:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    scheduleCleanup(config);
    return [];
  }
}

// Retrieve video files for a magnet
async function getFilesFromMagnetId(magnetId, source, config) {
  const url = `https://api.alldebrid.com/v4/magnet/files?apikey=${config.API_KEY_ALLEDBRID}`;
  const formData = new FormData();
  formData.append("id[]", magnetId);

  try {
    logger.info(`🔄 Retrieving files for magnet ID: ${magnetId}`);
    const response = await axios.post(url, formData, {
      headers: {
        "Authorization": `Bearer ${config.API_KEY_ALLEDBRID}`,
        ...formData.getHeaders()
      }
    });

    if (response.data.status === "success") {
      const files = response.data.data.magnets[0].files;
      const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".wmv"];

      // Recursive function to extract only video files
      const extractVideos = (fileList) => {
        const videos = [];
        fileList.forEach(file => {
          if (file.e && Array.isArray(file.e)) {
            // If the file contains sub-files, process them recursively
            videos.push(...extractVideos(file.e));
          } else if (file.n && file.l) {
            // Check if the file is a video
            const fileName = file.n.toLowerCase();
            if (videoExtensions.some(ext => fileName.endsWith(ext))) {
              videos.push({
                name: file.n,
                size: file.s || 0,
                link: file.l,
                source // Ajout de la source
              });
            }
          }
        });
        return videos;
      };

      // Extract video files
      const filteredVideos = extractVideos(files);

      logger.info(`🎥 ${filteredVideos.length} video(s) found for magnet ID: ${magnetId}`);
      logger.debug(`🎥 Filtered videos for magnet ID ${magnetId}: ${JSON.stringify(filteredVideos, null, 2)}`);

      return filteredVideos;
    } else {
      logger.warn("❌ Error retrieving files:", response.data.data);
      return [];
    }
  } catch (error) {
    logger.error("❌ File retrieval error:", error);
    return [];
  }
}

// Unlock a link via AllDebrid
async function unlockFileLink(fileLink, config) {
  const url = "http://api.alldebrid.com/v4/link/unlock";
  const formData = new FormData();
  formData.append("link", fileLink);

  try {
    logger.info(`🔄 Unlocking link: ${fileLink}`);
    const response = await axios.post(url, formData, {
      headers: {
        "Authorization": `Bearer ${config.API_KEY_ALLEDBRID}`,
        ...formData.getHeaders()
      }
    });

    if (response.data.status === "success") {
      return response.data.data.link;
    } else {
      logger.warn("❌ Error unlocking link:", response.data.data);
      return null;
    }
  } catch (error) {
    logger.error("❌ Unlock error:", error);
    return null;
  }
}

// Delete the 10 oldest magnets if total > 500
async function cleanupOldMagnets(config, maxCount = 500, deleteCount = 10) {
  try {
    const magnets = await getAllMagnets();
    logger.debug(`🔢 Magnets in SQLite: ${magnets.length}`);
    if (magnets.length > maxCount) {
      const toDelete = magnets.slice(0, deleteCount);
      logger.info(`🧹 Deleting ${toDelete.length} oldest magnets (limit: ${deleteCount}) because total > ${maxCount}.`);

      // Prepare formData with multiple ids[]
      const formData = new FormData();
      toDelete.forEach(magnet => formData.append('ids[]', magnet.id));

      const url = `https://api.alldebrid.com/v4/magnet/delete?apikey=${config.API_KEY_ALLEDBRID}`;
      try {
        const response = await axios.post(url, formData, {
          headers: {
            "Authorization": `Bearer ${config.API_KEY_ALLEDBRID}`,
            ...formData.getHeaders()
          }
        });
        if (response.data.status === "success") {
          logger.info(`🗑️ Deleted magnets: ${toDelete.map(m => m.name || m.id).join(', ')}`);
          // Remove from DB
          for (const magnet of toDelete) {
            await deleteMagnet(magnet.id);
          }
        } else {
          logger.warn(`❌ Failed to delete magnets: ${JSON.stringify(response.data, null, 2)}`);
        }
      } catch (err) {
        logger.error(`❌ Error deleting magnets: ${err.message}`);
      }
    }
  } catch (err) {
    logger.error("❌ Error during magnet cleanup:", err.message);
  }
}

module.exports = { uploadMagnets, getFilesFromMagnetId, unlockFileLink, cleanupOldMagnets };