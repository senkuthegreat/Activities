const iframe = new iFrame()

// Track if we've found a video
let videoFound = false
let checkInterval: number | null = null
let jwPlayerInterval: number | null = null
let lastSentTime = 0
let lastSentDuration = 0

// Define JWPlayer interface
interface JWPlayer {
  getDuration: () => number
  getPosition: () => number
  getState: () => string
}

// Extend Window interface to include jwplayer
declare global {
  interface Window {
    jwplayer?: () => JWPlayer
  }
}

// Try to detect which player we're dealing with
const hostname = window.location.hostname
const isHydrax = hostname.includes('hydrax')
const isVidCloud = hostname.includes('vidcloud')
const isPixelDrain = hostname.includes('pixeldrain')

// Function to find and track video - more aggressive approach
function findAndTrackVideo(): boolean {
  // Special handling for specific players
  if (isHydrax) {
    return findHydraxVideo()
  }
  else if (isVidCloud) {
    return findVidCloudVideo()
  }
  else if (isPixelDrain) {
    return findPixelDrainVideo()
  }

  // Try standard video element first (most common case)
  const video = document.querySelector<HTMLVideoElement>('video')
  if (video && !Number.isNaN(video.duration) && video.duration > 0) {
    setupVideoTracking(video)
    return true
  }

  // Try multiple selector approaches (one at a time to reduce DOM queries)
  const videoSelectors = [
    '.video-js video', // VideoJS
    '.plyr video', // Plyr player
    '*[id*="player"] video', // Video in player div
    '.jw-video', // JW Player
    '.vjs-tech', // Video.js
    'video.op-player__media', // Oplayer
  ]

  // Try each selector
  for (const selector of videoSelectors) {
    const video = document.querySelector<HTMLVideoElement>(selector)
    if (video && !Number.isNaN(video.duration) && video.duration > 0) {
      setupVideoTracking(video)
      return true
    }
  }

  // Try to find player objects in window
  if (window.jwplayer) {
    const player = window.jwplayer()
    if (player && typeof player.getDuration === 'function' && typeof player.getPosition === 'function') {
      setupJWPlayerTracking(player)
      return true
    }
  }

  return false
}

// Special handler for Hydrax
function findHydraxVideo(): boolean {
  // Try to find Hydrax player
  const hydraxPlayer = document.querySelector('#hydrax-player')
  if (hydraxPlayer) {
    const video = hydraxPlayer.querySelector<HTMLVideoElement>('video')
    if (video && !Number.isNaN(video.duration) && video.duration > 0) {
      setupVideoTracking(video)
      return true
    }
  }

  // Try standard video element
  const video = document.querySelector<HTMLVideoElement>('video')
  if (video && !Number.isNaN(video.duration) && video.duration > 0) {
    setupVideoTracking(video)
    return true
  }

  return false
}

// Special handler for VidCloud
function findVidCloudVideo(): boolean {
  // VidCloud often uses JW Player
  if (window.jwplayer) {
    const player = window.jwplayer()
    if (player && typeof player.getDuration === 'function' && typeof player.getPosition === 'function') {
      setupJWPlayerTracking(player)
      return true
    }
  }

  // Try standard video element
  const video = document.querySelector<HTMLVideoElement>('video')
  if (video && !Number.isNaN(video.duration) && video.duration > 0) {
    setupVideoTracking(video)
    return true
  }

  return false
}

// Special handler for PixelDrain (Oplayer)
function findPixelDrainVideo(): boolean {
  // Try Oplayer specific selector
  const video = document.querySelector<HTMLVideoElement>('video.op-player__media')
  if (video && !Number.isNaN(video.duration) && video.duration > 0) {
    setupVideoTracking(video)
    return true
  }

  // Try standard video element
  const standardVideo = document.querySelector<HTMLVideoElement>('video')
  if (standardVideo && !Number.isNaN(standardVideo.duration) && standardVideo.duration > 0) {
    setupVideoTracking(standardVideo)
    return true
  }

  return false
}

// Setup tracking for JW Player
function setupJWPlayerTracking(player: JWPlayer): boolean {
  // Clear any existing interval
  if (jwPlayerInterval !== null) {
    clearInterval(jwPlayerInterval)
  }

  // Send initial data
  sendJWPlayerData(player)

  // Set up interval to send data
  jwPlayerInterval = setInterval(() => {
    sendJWPlayerData(player)
  }, 1000)

  // Mark that we found a video
  videoFound = true

  // Clear the check interval if it exists
  if (checkInterval !== null) {
    clearInterval(checkInterval)
    checkInterval = null
  }

  return true
}

// Send data from JW Player
function sendJWPlayerData(player: JWPlayer): void {
  try {
    const duration = player.getDuration()
    const currentTime = player.getPosition()
    const paused = player.getState() !== 'playing'

    // Only send if values have changed significantly
    if (duration && currentTime &&
        (Math.abs(currentTime - lastSentTime) > 0.5 ||
         Math.abs(duration - lastSentDuration) > 0.5)) {
      iframe.send({
        currTime: currentTime,
        duration,
        paused,
      })

      lastSentTime = currentTime
      lastSentDuration = duration
    }
  }
  catch {
    // Ignore errors
  }
}

// Setup tracking for a video element
function setupVideoTracking(video: HTMLVideoElement): boolean {
  // Remove any existing event listeners to avoid duplicates
  video.removeEventListener('timeupdate', onTimeUpdate)

  // Add new event listener
  video.addEventListener('timeupdate', onTimeUpdate)

  // Send initial data
  sendVideoData(video)

  // Mark that we found a video
  videoFound = true

  // Clear the interval if it exists
  if (checkInterval !== null) {
    clearInterval(checkInterval)
    checkInterval = null
  }

  return true
}

// Timeupdate event handler
function onTimeUpdate(event: Event): void {
  const video = event.target as HTMLVideoElement
  sendVideoData(video)
}

// Function to send video data
function sendVideoData(video: HTMLVideoElement): void {
  if (video && !Number.isNaN(video.duration) && video.duration > 0) {
    // Only send if values have changed significantly
    if (Math.abs(video.currentTime - lastSentTime) > 0.5 ||
        Math.abs(video.duration - lastSentDuration) > 0.5) {
      iframe.send({
        currTime: video.currentTime,
        duration: video.duration,
        paused: video.paused,
      })

      lastSentTime = video.currentTime
      lastSentDuration = video.duration
    }
  }
}

// Check for video on every UpdateData event, but not too frequently
let lastUpdateCheck = 0
iframe.on('UpdateData', () => {
  const now = Date.now()
  // Only check every 2 seconds if we've already found a video
  if (!videoFound || now - lastUpdateCheck > 2000) {
    findAndTrackVideo()
    lastUpdateCheck = now
  }
})

// Initial check
findAndTrackVideo()

// Also check periodically (every 500ms) for the first 10 seconds
// This helps with servers that load videos dynamically
if (!videoFound) {
  let attempts = 0
  checkInterval = setInterval(() => {
    if (findAndTrackVideo() || attempts >= 20) {
      clearInterval(checkInterval as number)
      checkInterval = null
    }
    attempts++
  }, 500)
}

// Set up MutationObserver to detect video elements
const observer = new MutationObserver(() => {
  // Only process if we haven't found a video
  if (!videoFound) {
    findAndTrackVideo()
  }
})

// Observe the document body for changes, with optimized config
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: false,
})
