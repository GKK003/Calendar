const BASE = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/'

export const LIBRARY = [
  { id: 'sintel', title: 'Sintel', type: 'Movies', genres: ['Fantasy', 'Adventure'], year: 2010, desc: 'A young woman searches a harsh world for the dragon she once raised.', src: BASE + 'Sintel.mp4', poster: '' },
  { id: 'tears', title: 'Tears of Steel', type: 'Movies', genres: ['Sci-fi', 'Action'], year: 2012, desc: 'A group of warriors and scientists try to save the world from robots.', src: BASE + 'TearsOfSteel.mp4', poster: '' },
  { id: 'bunny', title: 'Big Buck Bunny', type: 'Anime', genres: ['Comedy', 'Family'], year: 2008, desc: 'A gentle giant rabbit teaches three bullies a lesson.', src: BASE + 'BigBuckBunny.mp4', poster: '' },
  { id: 'dream', title: 'Elephants Dream', type: 'Series', genres: ['Surreal', 'Animation'], year: 2006, desc: 'Two strange characters explore a mechanical world.', src: BASE + 'ElephantsDream.mp4', poster: '' },
]

export const TABS = ['All', 'Movies', 'Series', 'Anime']
