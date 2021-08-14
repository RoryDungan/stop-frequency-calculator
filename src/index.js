#!/usr/bin/env node

const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const processGTFS = require('./data-wrangler')

const { argv } = yargs(hideBin(process.argv))
    .option('city', {
        demandOption: true,
        describe: 'Name of the city to generate data for.',
        type: 'string'
    })
    .option('walkingRadius', {
        describe: 'Distance in km around each stop to shade',
        type: 'number',
        default: 0.8
    })

const timeframes = {
    allday: [7 * 60 * 60, 22 * 60 * 60],
    night: [22 * 60 * 60, 24 * 60 * 60]
}

const mins = [10, 15, 20]

const settingsCombos = mins.flatMap(m => 
    Object.keys(timeframes).map(t => ({ 
        city: argv.city,
        startTime: timeframes[t][0],
        endTime: timeframes[t][1],
        timeframe: t,
        mins: m,
        walkingRadius: argv.walkingRadius
    }))
)

const main = async () => {
    for (const settings of settingsCombos) {
        await processGTFS(settings)
    }
}

main()
    .catch(err => console.error(err && err.stack || err))

