const iframe = new iFrame()

// Track if we've found a video
let videoFound = false
let jwPlayerInterval: number | null = null
let lastUpdateTime = 0

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

// Function to find and track video
function findAndTrackVideo() {
  // Try standard video element first
  const video = document.querySelector<HTMLVideoElement>('video')
  if (video && !Number.isNaN(video.duration) && video.duration > 0) {
    setupVideoTracking(video)
    return true
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

// Setup tracking for JW Player
function setupJWPlayerTracking(player: JWPlayer) {
  // Clear any existing interval
  if (jwPlayerInterval !== null) {
    clearInterval(jwPlayerInterval)
  }

  // Send initial data
  sendJWPlayerData(player)

  // Set up interval to send data
  jwPlayerInterval = setInterval(() => {
    sendJWPlayerData(player)
  }, 3000) // Reduced to 3 seconds

  // Mark that we found a video
  videoFound = true

  return true
}

// Send data from JW Player
function sendJWPlayerData(player: JWPlayer) {
  try {
    const duration = player.getDuration()
    const currentTime = player.getPosition()
    const paused = player.getState() !== 'playing'

    // Send to Discord via iframe
    iframe.send({
      currTime: currentTime,
      duration,
      paused,
      assets: {
        large_image: paused ? 'pause' : 'play',
      },
    })
  }
  catch {
    // Ignore errors
  }
}

// Setup tracking for a video element
function setupVideoTracking(video: HTMLVideoElement) {
  // Remove any existing event listeners to avoid duplicates
  video.removeEventListener('timeupdate', onTimeUpdate)

  // Add new event listener
  video.addEventListener('timeupdate', onTimeUpdate)

  // Send initial data
  sendVideoData(video)

  // Mark that we found a video
  videoFound = true

  return true
}

// Timeupdate event handler
function onTimeUpdate(event: Event) {
  const video = event.target as HTMLVideoElement
  sendVideoData(video)
}

// Function to send video data
function sendVideoData(video: HTMLVideoElement) {
  if (video && !Number.isNaN(video.duration) && video.duration > 0) {
    // Throttle updates to reduce CPU usage
    const now = Date.now()
    if (now - lastUpdateTime < 3000) {
      return // Skip updates that are too frequent
    }

    // Send to Discord via iframe
    iframe.send({
      currTime: video.currentTime,
      duration: video.duration,
      paused: video.paused,
      assets: {
        large_image: video.paused ? 'pause' : 'play',
      },
    })

    lastUpdateTime = now
  }
}

// Check for video on every UpdateData event, but not too frequently
let lastCheckTime = 0
iframe.on('UpdateData', () => {
  const now = Date.now()
  // Only check every 5 seconds
  if (now - lastCheckTime > 5000) {
    if (!findAndTrackVideo() && !videoFound) {
      // If no video found, send default paused state
      iframe.send({
        currTime: 0,
        duration: 0,
        paused: true,
        assets: {
          large_image: 'pause',
        },
      })
    }
    lastCheckTime = now
  }
})

// Set up a periodic check for videos
const periodicCheck = setInterval(() => {
  if (!videoFound) {
    if (!findAndTrackVideo()) {
      // If still no video found, send default paused state
      iframe.send({
        currTime: 0,
        duration: 0,
        paused: true,
        assets: {
          large_image: 'pause',
        },
      })
    }
    else {
      // If video found, clear this interval as it's no longer needed
      clearInterval(periodicCheck)
    }
  }
  else {
    // If video already found, clear this interval as it's no longer needed
    clearInterval(periodicCheck)
  }
}, 5000)

// Initial check
if (!findAndTrackVideo()) {
  // If no video found initially, send default paused state
  iframe.send({
    currTime: 0,
    duration: 0,
    paused: true,
    assets: {
      large_image: 'pause',
    },
  })
}
