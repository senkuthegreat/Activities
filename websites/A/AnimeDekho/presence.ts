import { ActivityType, Assets, getTimestamps } from 'premid'

const presence = new Presence({
  clientId: '1377295092578123926',
})

const browsingTimestamp = Math.floor(Date.now() / 1000)

// Store video data
let data: {
  currTime: number
  duration: number
  paused: boolean
  timestamp: number
} = null as any

// Track the last URL to detect page changes
let lastUrl = document.location.href
let _urlCheckInterval: number | null = null

enum ActivityAssets {
  Logo = 'https://i.pinimg.com/736x/cf/08/4e/cf084e53ab1a153662c5cb96c193a284.jpg',
  Search = 'search',
  Play = 'play',
  Pause = 'pause',
}

// Handle iframe data with timestamp to detect freshness
presence.on('iFrameData', (iframeData: { currTime: number, duration: number, paused: boolean }) => {
  if (iframeData.currTime && iframeData.duration) {
    // Update data with timestamp (reuse object if possible)
    if (data) {
      data.currTime = iframeData.currTime
      data.duration = iframeData.duration
      data.paused = iframeData.paused
      data.timestamp = Date.now()
    }
    else {
      data = {
        currTime: iframeData.currTime,
        duration: iframeData.duration,
        paused: iframeData.paused,
        timestamp: Date.now(),
      }
    }
  }
})

// Check for URL changes every second
_urlCheckInterval = setInterval(() => {
  const currentUrl = document.location.href
  if (currentUrl !== lastUrl) {
    data = null as any
    lastUrl = currentUrl
  }
}, 1000)

presence.on('UpdateData', async () => {
  const presenceData: PresenceData = {
    startTimestamp: browsingTimestamp,
    type: ActivityType.Watching,
  }

  const { pathname, search, href } = document.location
  const buttons = await presence.getSetting<boolean>('buttons')
  const timestamps = await presence.getSetting<boolean>('timestamps')

  // Check if data is stale (more than 3 seconds old)
  const now = Date.now()
  if (data && now - data.timestamp > 3000) {
    data = null as any
  }

  // Set default logo only for homepage and non-anime pages
  if (pathname === '/' || pathname === '/home/' || search.startsWith('?s=')
      || pathname.includes('/recent') || pathname.includes('/schedule')) {
    presenceData.largeImageKey = ActivityAssets.Logo
  }

  // Homepage
  if (pathname === '/home/') {
    presenceData.details = 'Browsing Homepage'
    presenceData.smallImageKey = ActivityAssets.Search
  }

  // Search page
  else if (search.startsWith('?s=')) {
    const searchQuery = document.querySelector('h1.section-title span')?.textContent
    presenceData.details = 'Searching'
    presenceData.state = searchQuery ? `for "${searchQuery}"` : 'for anime'
    presenceData.smallImageKey = ActivityAssets.Search
  }

  // Series category page
  else if (pathname === '/series/') {
    presenceData.details = 'Browsing Series Category'
    presenceData.smallImageKey = ActivityAssets.Search
  }

  // Movie category page
  else if (pathname === '/movie/') {
    presenceData.details = 'Browsing Movie Category'
    presenceData.smallImageKey = ActivityAssets.Search
  }

  // Anime page
  else if (pathname.startsWith('/series/')) {
    const title = document.querySelector('h1')?.textContent
    const thumbnail = document.querySelector('.post-thumbnail img')?.getAttribute('src')

    presenceData.details = 'Viewing Anime'
    presenceData.state = title || 'Unknown Anime'
    if (thumbnail) {
      presenceData.largeImageKey = String(thumbnail)
      presenceData.largeImageText = title || 'Unknown Anime'
    }
    if (buttons) {
      presenceData.buttons = [
        {
          label: 'View Details',
          url: href,
        },
      ]
    }
  }

  // Movie page
  else if (pathname.startsWith('/movie/') && pathname !== '/movie/') {
    const title = document.querySelector('h1')?.textContent
    const thumbnail = document.querySelector('.post-thumbnail img')?.getAttribute('src')

    presenceData.details = 'Viewing Movie'
    presenceData.state = title || 'Unknown Movie'
    if (thumbnail) {
      presenceData.largeImageKey = String(thumbnail)
      presenceData.largeImageText = title || 'Unknown Movie'
    }

    // Handle video data for timestamps (for direct movie watching)
    if (data && timestamps) {
      if (!data.paused && data.currTime > 0 && data.duration > 0) {
        // Video is playing - calculate timestamps only when needed
        const [startTimestamp, endTimestamp] = getTimestamps(
          Math.floor(data.currTime),
          Math.floor(data.duration)
        )
        presenceData.startTimestamp = startTimestamp
        presenceData.endTimestamp = endTimestamp
        presenceData.smallImageKey = ActivityAssets.Play
        presenceData.smallImageText = 'Watching'
      }
      else {
        // Video is paused
        presenceData.smallImageKey = ActivityAssets.Pause
        presenceData.smallImageText = 'Paused'
        delete presenceData.startTimestamp
        delete presenceData.endTimestamp
      }
    }

    if (buttons) {
      presenceData.buttons = [
        {
          label: 'Watch Movie',
          url: href,
        },
      ]
    }
  }

  // Watch page
  else if (pathname.includes('/epi/')) {
    const rawtitle = document.querySelector('.entry-title')?.textContent || ''
    const title = rawtitle.replace(/Season\s\d+\sEpisode\s\d+|\d+x\d+$/i, '').trim()
    const episode = document.querySelector('.season-episode')?.textContent || ''
    const thumbnail = document.querySelector('.post-thumbnail img')?.getAttribute('src')

    presenceData.details = title || 'Unknown Anime'
    presenceData.state = episode || 'Unknown Episode'

    if (thumbnail) {
      presenceData.largeImageKey = String(thumbnail)
      presenceData.largeImageText = title || 'Unknown Anime'
    }

    // Handle video data for timestamps
    if (data && timestamps) {
      if (!data.paused && data.currTime > 0 && data.duration > 0) {
        // Video is playing - calculate timestamps only when needed
        const [startTimestamp, endTimestamp] = getTimestamps(
          Math.floor(data.currTime),
          Math.floor(data.duration)
        )
        presenceData.startTimestamp = startTimestamp
        presenceData.endTimestamp = endTimestamp
        presenceData.smallImageKey = ActivityAssets.Play
        presenceData.smallImageText = 'Watching'
      }
      else {
        // Video is paused
        presenceData.smallImageKey = ActivityAssets.Pause
        presenceData.smallImageText = 'Paused'
        delete presenceData.startTimestamp
        delete presenceData.endTimestamp
      }
    }

    if (buttons) {
      // Simplified button creation with safer path handling
      presenceData.buttons = [{ label: 'Watch Episode', url: href }]

      // Try to extract anime ID for "View Series" button
      try {
        const match = pathname.match(/\/epi\/([^/]+)/)
        if (match && match[1]) {
          const animeId = match[1].replace(/-\d+x\d+$/, '')
          presenceData.buttons.push({
            label: 'View Series',
            url: `${window.location.origin}/series/${animeId}`,
          })
        }
      }
      catch {
        // If anything fails, we already have the "Watch Episode" button
      }
    }
  }

  // Recent episodes page
  else if (pathname.includes('/recent')) {
    presenceData.details = 'Browsing Recent Episodes'
    presenceData.smallImageKey = ActivityAssets.Search
  }

  // Schedule page
  else if (pathname.includes('/schedule')) {
    presenceData.details = 'Viewing Schedule'
    presenceData.smallImageKey = ActivityAssets.Search
  }

  // Add this check right here, before the final setActivity calls
  if (!buttons && presenceData.buttons) {
    delete presenceData.buttons
  }

  // These should be the last lines of your UpdateData event handler
  if (presenceData.details)
    presence.setActivity(presenceData)
  else
    presence.setActivity()
})
