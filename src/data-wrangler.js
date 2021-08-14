function display() {
     for (const arg of arguments) {
          console.log(arg);
     }
}
display.text = display.html = display.plot = display.markdown = display.json = display.geo = display;
display.table = function () {
     for (const arg of arguments) {
          console.table(arg);
     }
}

async function main() {
    // Import libraries
    const turf = require('@turf/turf')
    const fs = require('fs')
    const mongodb = require('mongodb')
    const dataForge = require('data-forge')
    const msgpack = require('msgpack5')()
    // Settings
    const settings = {
        city: 'mississauga',
        startTime: 7 * 60 * 60, // 07:00:00 in seconds
        endTime: 22 * 60 * 60, // 22:00:00 in seconds
        mins: 10,
        walkingRadius: 0.8 // km
    }
    
    const { city, startTime, endTime, mins, walkingRadius } = settings
    
    display(settings)
    // Connect to DB
    const url = 'mongodb://localhost:27017'
    const dbName = `gtfs-${city}`
    
    console.log('connecting...')
    const client = await mongodb.MongoClient.connect(url, { useUnifiedTopology: true })
    const db = client.db(dbName)
    console.log('connected!')
    const stopsFile = `stops-${city}.json`
    
    let stops = null
    if (!fs.existsSync(stopsFile)) {
        stops = await db.collection('stoptimes').aggregate([
            {
                $match: {
                    arrival_timestamp: {
                        $gte: startTime,
                        $lte: endTime
                    }
                }
            },
            {
                $sort: { arrival_timestamp: 1 }
            },
            {
                $group: {
                    _id: '$stop_id',
                    stop_times: {
                        $push: {
                            arrival_time: '$arrival_time',
                            arrival_timestamp: '$arrival_timestamp',
                            trip_id: '$trip_id'
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'stops',
                    localField: '_id',
                    foreignField: 'stop_id',
                    as: 'stop'
                }
            },
            {
                $replaceRoot: {
                    newRoot: {
                        $mergeObjects: [
                            { $arrayElemAt: ['$stop', 0] },
                            { stop_times: '$stop_times' }
                        ]
                    }
                }
            }
        ], { allowDiskUse: true }).toArray()
    
        fs.writeFileSync(stopsFile, JSON.stringify(stops))
    } else {
        stops = JSON.parse(fs.readFileSync(stopsFile))
    }
    const minDelayBetweenStops = mins * 60 // in seconds
    
    const maxTimeBetweenStops = stopTimes => {
        const shortestSpanBetweenTimes = stopTimes.reduce((acc, curr) => ({
            lastTimestamp: curr.arrival_timestamp,
            span: Math.max(acc.span, curr.arrival_timestamp - acc.lastTimestamp)
        }), { lastTimestamp: startTime, span: 0 })
        return Math.max(shortestSpanBetweenTimes.span, endTime - shortestSpanBetweenTimes.lastTimestamp)
    }
    
    
    const stopsWithMatchingServiceLevel = stops
        .filter(s => maxTimeBetweenStops(s.stop_times) <= minDelayBetweenStops)
    
    display(`Total number of stops: ${stops.length}`)
    
    display(`Number of stops with service every ${minDelayBetweenStops / 60} min: ${stopsWithMatchingServiceLevel.length}`)
    
    display(stops.slice(0, 40).map(s => maxTimeBetweenStops(s.stop_times)))
    const allStops = stops.map(s => ({
        x: s.stop_lon,
        y: s.stop_lat,
        d: maxTimeBetweenStops(s.stop_times)
    }))
    const points = stopsWithMatchingServiceLevel
        .map(s => [s.stop_lon, s.stop_lat])
    
    display(points.slice(0, 10))
    
    const geo = {
        type: 'MultiPoint',
        coordinates: points
    }
    const buffered = turf.buffer(geo, walkingRadius)
    fs.writeFileSync(`${city}-allday-${mins}mins.msg`, msgpack.encode(buffered))
    
    const coords = {
        sydney: [-33.8688, 151.2093],
        brisbane: [-27.4698, 153.0251],
        melbourne: [-37.8136, 144.9631],
        perth: [-31.9505, 115.8605],
        canberra: [-35.2809, 149.13],
        adelaide: [-34.9285, 138.6007],
        hobart: [-42.8821, 147.3272],
        darwin: [-12.4634, 130.8456],
        toronto: [43.741667, -79.373333],
        vancouver: [49.260833, -123.113889],
        mississauga: [43.6, -79.65]
    }
    
    if (coords[city]) {
        display.geo({
            location: coords[city],
            zoom: 12,
            geojson: buffered
        })
    }
    await client.close(); // Close connection to database.

}

main()
    .then(() => console.log("Done"))
    .catch(err => console.error(err && err.stack || err));
