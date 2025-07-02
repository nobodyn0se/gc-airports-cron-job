import * as pg from 'pg';
const { Pool } = pg;
import queries from '../queries/airports-queries.mjs';
import logger from "../middleware/logger.mjs";

let pool;

const getPool = () => {
    if (!pool || pool.ended) {
        // Create a new pool instance using the connection string
        pool = new Pool({
            connectionString: process.env.DB_URL,
            max: 1, // Maximum number of clients in the pool
            idleTimeoutMillis: 120000,
        });

        pool.on('remove', () => {
            logger.warn('Pool connection ended, caught by listener');
        });

        logger.warn('Started a new pool at start or the previous one closed');
    }

    return pool;
};
const batchUpsertAirports = async (client, airportsBatch) => {
    if (airportsBatch.length === 0) {
        return;
    }

    const columns = [
        'id',
        'ident',
        'type',
        'name',
        'lat',
        'long',
        'elevation',
        'icao',
        'iata',
        'municipality',
        'country',
    ];

    const valuePlaceholders = airportsBatch
        .map((airport, airportIndex) => {
            return `(${columns.map((col, colIndex) => `$${airportIndex * columns.length + colIndex + 1}`).join(', ')})`;
        })
        .join(', ');

    const values = airportsBatch.flatMap((airport) => [
        airport.id,
        airport.ident,
        airport.type,
        airport.name,
        airport.lat,
        airport.long,
        airport.elevation,
        airport.icao,
        airport.iata,
        airport.municipality,
        airport.country,
    ]);

    const queryText = queries.batchUpsertAirportsQuery(
        columns.join(', '),
        valuePlaceholders
    );

    try {
        await client.query(queryText, values);
        logger.info(`Upserted a batch of ${airportsBatch.length} airports`);
    } catch (err) {
        logger.error(`Upsert Error occurred`);
        throw err;
    }
};

export { batchUpsertAirports, getPool };