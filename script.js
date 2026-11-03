const absorptionCoeff = {
    concrete: 0.02,
    hardwood: 0.07,
    tile: 0.03,
    "carpet thin": 0.14,
    "carpet thick": 0.35,
    drywall: 0.05,
    glass: 0.03,
    bricks: 0.02,
    "acoustic tile": 0.55,
};

class Room {
    constructor({ name, lenghtM, widthM, heightM, floorMaterial, wallMaterial, ceilingMaterial }) {
        this.name = name;
        this.lenghtM = lenghtM;
        this.widthM = widthM;
        this.heightM = heightM;
        this.floorMaterial = floorMaterial;
        this.wallMaterial = wallMaterial;
        this.ceilingMaterial = ceilingMaterial;
    }
}

class CandidateSpot {
    constructor({ room, label, x, y }) {
        this.room = room;
        this.label = label;
        this.x = x;
        this.y = y;
    }
}

function scoreSpot(spot, listeningX, listeningY, obstacles) {
    const room = spot.room;
    const distFromLengthWalls = Math.min(spot.x, room.lenghtM - spot.x);
    const distFromWidthWalls = Math.min(spot.y, room.widthM - spot.y);

    const nearCorner = distFromLengthWalls < 0.3 && distFromWidthWalls < 0.3;
    const nearWall = distFromLengthWalls < 0.3 || distFromWidthWalls < 0.3;

    if (nearCorner) {
        return { score: 0, reason: "Too close to a corner (bass buildup risk)." };
    }
    if (nearWall) {
        return { score: 40, reason: "Too close to a wall." };
    }

    for (let i = 0; i < obstacles.length; i++) {
        const obsDx = spot.x - obstacles[i].x;
        const obsDy = spot.y - obstacles[i].y;
        const distToObstacle = Math.sqrt(obsDx * obsDx + obsDy * obsDy);
        if (distToObstacle < 0.5) {
            return { score: 10, reason: "Too close to an obstacle (door or furniture)." };
        }
    }

    const idealRatio = 0.25;
    const ratioL = distFromLengthWalls / room.lenghtM;
    const ratioW = distFromWidthWalls / room.widthM;
    const wallDiff = (Math.abs(ratioL - idealRatio) + Math.abs(ratioW - idealRatio)) / 2;
    let score = Math.max(50, 100 - wallDiff * 200);

    const dx = spot.x - listeningX;
    const dy = spot.y - listeningY;
    const distanceToListener = Math.sqrt(dx * dx + dy * dy);

    const roomDiagonal = Math.sqrt(room.lenghtM * room.lenghtM + room.widthM * room.widthM);
    const idealListenDist = roomDiagonal * 0.3;
    const listenDiff = Math.abs(distanceToListener - idealListenDist) / roomDiagonal;

    score = score - listenDiff * 50;
    score = Math.max(0, Math.round(score));

    return { score: score, reason: "Good placement" };
}

function findBestSpot(room, listeningX, listeningY, obstacles) {
    let bestScore = -1;
    let bestSpot = null;

    for (let x = 0.5; x < room.lenghtM; x += 0.5) {
        for (let y = 0.5; y < room.widthM; y += 0.5) {
            const candidate = new CandidateSpot({ room: room, label: x + ", " + y, x: x, y: y });
            const result = scoreSpot(candidate, listeningX, listeningY, obstacles);
            if (result.score > bestScore) {
                bestScore = result.score;
                bestSpot = candidate;
            }
        }
    }

    return { spot: bestSpot, score: bestScore };
}

function findTopSpots(room, listeningX, listeningY, obstacles, topN) {
    const allResults = [];

    for (let x = 0.5; x < room.lenghtM; x += 0.5) {
        for (let y = 0.5; y < room.widthM; y += 0.5) {
            const candidate = new CandidateSpot({ room: room, label: x + ", " + y, x: x, y: y });
            const result = scoreSpot(candidate, listeningX, listeningY, obstacles);
            allResults.push({ spot: candidate, score: result.score });
        }
    }

    allResults.sort(function(a, b) {
        return b.score - a.score;
    });
    return allResults.slice(0, topN);
}

function calculateRT60(room) {
    const floorArea = room.lenghtM * room.widthM;
    const ceilingArea = room.lenghtM * room.widthM;
    const wallArea = 2 * (room.lenghtM * room.heightM) + 2 * (room.widthM * room.heightM);

    const floorAbs = floorArea * absorptionCoeff[room.floorMaterial];
    const ceilingAbs = ceilingArea * absorptionCoeff[room.ceilingMaterial];
    const wallAbs = wallArea * absorptionCoeff[room.wallMaterial];

    const totalAbsorption = floorAbs + ceilingAbs + wallAbs;
    const volume = room.lenghtM * room.widthM * room.heightM;

    return (0.161 * volume) / totalAbsorption;
}

// turns the rt60 number into plain words
function explainRT60(rt60) {
    if (rt60 < 0.3) {
        return { label: "very dry", text: "sound dies almost instantly. voices and music can feel flat and a bit lifeless." };
    } else if (rt60 <= 0.6) {
        return { label: "just right", text: "sound fades away quickly and cleanly. this is what you want for music and talking." };
    } else if (rt60 <= 1.0) {
        return { label: "a bit lively", text: "there's a little echo, but it still sounds fine for most things." };
    } else if (rt60 <= 1.5) {
        return { label: "echoey", text: "you'll hear a noticeable echo. rugs, curtains or a sofa would help soak it up." };
    } else {
        return { label: "very echoey", text: "sound bounces around for ages, so speech and music get muddy. soft stuff like rugs, curtains and bookshelves will make a big difference." };
    }
}

// a little bar showing where the room sits. green is the ideal zone.
function drawRT60Scale(rt60) {
    const barWidth = 300;
    const maxSeconds = 2.5;
    const markerX = 10 + (Math.min(rt60, maxSeconds) / maxSeconds) * barWidth;
    const idealStart = 10 + (0.3 / maxSeconds) * barWidth;
    const idealEnd = 10 + (0.6 / maxSeconds) * barWidth;

    let svg = '<svg width="' + (barWidth + 20) + '" height="60" style="font-family: sans-serif;">';
    svg += '<rect x="10" y="20" width="' + barWidth + '" height="14" fill="#e5e5e5" />';
    svg += '<rect x="' + idealStart + '" y="20" width="' + (idealEnd - idealStart) + '" height="14" fill="green" />';
    svg += '<line x1="' + markerX + '" y1="12" x2="' + markerX + '" y2="42" stroke="black" stroke-width="3" />';
    svg += '<text x="10" y="56" font-size="12">0s</text>';
    svg += '<text x="' + ((idealStart + idealEnd) / 2) + '" y="56" font-size="12" text-anchor="middle">ideal</text>';
    svg += '<text x="' + (10 + barWidth) + '" y="56" font-size="12" text-anchor="end">' + maxSeconds + 's+</text>';
    svg += '</svg>';
    return svg;
}

function RatingExplained(rating) {
    if (rating === "Excellent") {
        return "The room has ideal sound absorption - not too muffled or echoey.";
    } else if (rating === "Good") {
        return "The room sounds slightly livelier than ideal but still pleasant.";
    } else if (rating === "Fair") {
        return "The room has noticeable echo. Adding sound-absorbing materials (rugs or curtains) may help.";
    } else {
        return "The room is too echoey. Sound will bounce a lot, making speech and music sound muddy.";
    }
}

// draws the room from plain numbers, so it works before the full form is filled in.
// spot is optional: pass null to leave the red dot out.
function drawRoomDiagram(lengthM, widthM, spot, listeningX, listeningY, obstacles) {
    const target = document.getElementById("roomDiagram");

    if (isNaN(lengthM) || isNaN(widthM) || lengthM <= 0 || widthM <= 0.1) {
        target.innerHTML = " ";
        return;
    }

    const maxSize = 320;
    const padding = 40;
    let widthPx, heightPx;

    if (lengthM > widthM) {
        widthPx = maxSize;
        heightPx = maxSize * (widthM / lengthM);
    } else {
        heightPx = maxSize;
        widthPx = maxSize * (lengthM / widthM);
    }

    const totalWidth = widthPx + padding * 2;
    const totalHeight = heightPx + padding * 2;

    function toPxX(m) { return padding + (m / lengthM) * widthPx; }
    function toPxY(m) { return padding + (m / widthM) * heightPx; }
    function insideRoom(x, y) { return x >= 0 && x <= lengthM && y >= 0 && y <= widthM; }

    let svg = '<svg width="' + totalWidth + '" height="' + totalHeight + '" style="font-family: sans-serif;">';

    svg += '<rect x="' + padding + '" y="' + padding + '" width="' + widthPx + '" height="' + heightPx + '" fill="#f5f5f5" stroke="#333" stroke-width="3" />';
    svg += '<text x="' + (padding + widthPx / 2) + '" y="' + (totalHeight - 10) + '" text-anchor="middle" font-size="13">length: ' + lengthM + 'm</text>';
    svg += '<text x="12" y="' + (padding + heightPx / 2) + '" text-anchor="middle" font-size="13" transform="rotate(-90, 12, ' + (padding + heightPx / 2) + ')">width: ' + widthM + 'm</text>';

    for (let i = 0; i < obstacles.length; i++) {
        if (insideRoom(obstacles[i].x, obstacles[i].y)) {
            svg += '<rect x="' + (toPxX(obstacles[i].x) - 6) + '" y="' + (toPxY(obstacles[i].y) - 6) + '" width="12" height="12" fill="gray" stroke="white" stroke-width="2" />';
        }
    }

    if (!isNaN(listeningX) && !isNaN(listeningY) && insideRoom(listeningX, listeningY)) {
        svg += '<circle cx="' + toPxX(listeningX) + '" cy="' + toPxY(listeningY) + '" r="9" fill="blue" stroke="white" stroke-width="2" />';
    }

    if (spot) {
        svg += '<circle cx="' + toPxX(spot.x) + '" cy="' + toPxY(spot.y) + '" r="9" fill="red" stroke="white" stroke-width="2" />';
    }

    svg += '</svg>';

    let legend = '<p style="font-size: 14px;">';
    if (spot) {
        legend += '<span style="color: red; font-size: 18px;">&#9679;</span> best spot for the speaker &nbsp;&nbsp;';
    }
    legend += '<span style="color: blue; font-size: 18px;">&#9679;</span> where you sit &nbsp;&nbsp;' +
        '<span style="color: gray; font-size: 18px;">&#9632;</span> in the way</p>';

    target.innerHTML = '<h3>your room(top view)</h3>' + svg + legend;
}

function updatePreview() {
    const lengthValue = parseFloat(document.getElementById("roomLength").value);
    const widthValue = parseFloat(document.getElementById("roomWidth").value);
    const listeningXValue = parseFloat(document.getElementById("listeningX").value);
    const listeningYValue = parseFloat(document.getElementById("listeningY").value);
    drawRoomDiagram(lengthValue, widthValue, null, listeningXValue, listeningYValue, getObstacles());
}

function addObstacleRow() {
    const row = document.createElement("div");
    row.className = "obstacleRow";
    row.innerHTML =
        'along the length: <input type="number" class="obstacleXInput" step="0.1" min="0"> ' +
        'along the width: <input type="number" class="obstacleYInput" step="0.1" min="0"> ' +
        '<button type="button" class="removeObstacleBtn">remove</button>';

    row.querySelector(".obstacleXInput").addEventListener("input", updatePreview);
    row.querySelector(".obstacleYInput").addEventListener("input", updatePreview);
    row.querySelector(".removeObstacleBtn").addEventListener("click", function() {
        row.remove();
        updatePreview();
    });

    document.getElementById("obstacleList").appendChild(row);
}

function getObstacles() {
    const obstacles = [];
    const rows = document.querySelectorAll(".obstacleRow");
    rows.forEach(function(row) {
        const x = parseFloat(row.querySelector(".obstacleXInput").value);
        const y = parseFloat(row.querySelector(".obstacleYInput").value);
        if (!isNaN(x) && !isNaN(y)) {
            obstacles.push({ x: x, y: y });
        }
    });
    return obstacles;
}

document.getElementById("addObstacleBtn").addEventListener("click", addObstacleRow);

["roomLength", "roomWidth", "listeningX", "listeningY"].forEach(function(id) {
    document.getElementById(id).addEventListener("input", updatePreview);
});

updatePreview();

document.getElementById("calculateBtn").addEventListener("click", function() {
    const nameValue = document.getElementById("roomName").value;
    const lengthValue = parseFloat(document.getElementById("roomLength").value);
    const widthValue = parseFloat(document.getElementById("roomWidth").value);
    const heightValue = parseFloat(document.getElementById("roomHeight").value);
    const floorValue = document.getElementById("floorMaterial").value;
    const wallValue = document.getElementById("wallMaterial").value;
    const ceilingValue = document.getElementById("ceilingMaterial").value;
    const listeningXValue = parseFloat(document.getElementById("listeningX").value);
    const listeningYValue = parseFloat(document.getElementById("listeningY").value);
    const obstacles = getObstacles();

    if (nameValue.trim().length === 0) {
        alert("Please enter a name for the room.");
        return;
    }
    if (isNaN(lengthValue) || lengthValue <= 0 || isNaN(widthValue) || widthValue <= 0 || isNaN(heightValue) || heightValue <= 0) {
        alert("Please enter valid positive numbers for length, width, and height.");
        return;
    }
    if (isNaN(listeningXValue) || isNaN(listeningYValue) ||
        listeningXValue < 0 || listeningXValue > lengthValue ||
        listeningYValue < 0 || listeningYValue > widthValue) {
        alert("Please enter where you sit, inside the room (along the length: 0 to the length, along the width: 0 to the width).");
        return;
    }

    const userRoom = new Room({
        name: nameValue,
        lenghtM: lengthValue,
        widthM: widthValue,
        heightM: heightValue,
        floorMaterial: floorValue,
        wallMaterial: wallValue,
        ceilingMaterial: ceilingValue
    });

    const rt60 = calculateRT60(userRoom);
    const best = findBestSpot(userRoom, listeningXValue, listeningYValue, obstacles);
    const topSpots = findTopSpots(userRoom, listeningXValue, listeningYValue, obstacles, 5);

    const bestX = best.spot.x;
    const bestY = best.spot.y;
    const percentAlongLength = Math.round(bestX / userRoom.lenghtM * 100);
    const percentAlongWidth = Math.round(bestY / userRoom.widthM * 100);

    const bestSpotDescription =
        "Place your speaker about " + bestX + "m from one wall, and " + bestY +
        "m from the wall next to it (roughly " + percentAlongLength +
        "% in from that corner along the length, and " + percentAlongWidth +
        "% in along the width).";

    let topSpotsHtml = "<h3>Top 5 Spots:</h3><ul>";
    topSpots.forEach(function(result) {
        topSpotsHtml += "<li>x=" + result.spot.x + "m, y=" + result.spot.y + "m (score: " + result.score + ")</li>";
    });
    topSpotsHtml += "</ul>";

        const explained = explainRT60(rt60);

    document.getElementById("result").innerHTML =
        "<h2>" + userRoom.name + "</h2>" +
        "<p>how echoey is it? <b>" + explained.label + "</b></p>" +
        "<p>" + explained.text + "</p>" +
        drawRT60Scale(rt60) +
        "<p>(a clap takes about " + rt60.toFixed(1) + " seconds to fade away in here. the green bit is where most listening rooms want to be. the technical name for this number is RT60, if you want to look it up.)</p>" +
        "<p>" + bestSpotDescription + "</p>";

    drawRoomDiagram(lengthValue, widthValue, best.spot, listeningXValue, listeningYValue, obstacles);
    document.getElementById("topSpots").innerHTML = topSpotsHtml;
});