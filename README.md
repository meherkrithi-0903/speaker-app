# where to put your speaker
a small web page that tells you where to put a speaker in your room.

you type in your room size, what the floor, walls and ceiling are made of, where you sit, and anything that's in the way (doors, furniture). it draws your room from above, shows how echoey it is in plain words, and marks the best spot for the speaker.
![Uploading Screenshot 2026-11-05 at 10.19.56 AM.png…]()

live version: [https://meherkrithi-0903.github.io/speaker-app/] 


## how to run it
you need node installed. then, inside this folder:
```
npx serve .
```
open `localhost:3000` in your browser.

## what's in here
- `index.html` is the form
- `script.js` is all the maths and the drawing
- `terminal-version/room.js` is where this started, a version you run in the terminal (`node room.js`)

## how it works
**echo time.** it works out how long a sound takes to fade in your room using Sabine's equation, which uses the room's volume and how much sound each surface soaks up. that number is called RT60. the page turns it into words ("just right", "echoey", etc.) and shows where your room sits on a bar. the green part of the bar, about 0.3 to 0.6 seconds, is the usual target for a listening room.

**best spot.** it tries a grid of spots across the room (every 0.5m) and scores each one:
- near a corner scores 0, and near a wall scores low
- near an obstacle scores low
- spots about a quarter of the way in from the walls score higher
- spots a sensible distance from where you sit score higher

the highest score wins, and the top 5 are listed.

## things to know
- it's an estimate, not a proper acoustic simulation. each material gets one average absorption number, and real rooms change that depending on the pitch of the sound
- the spot scoring is rules of thumb, not measurements
- it only handles rectangular rooms
- positions are measured from the top left corner of the room, as seen from above







