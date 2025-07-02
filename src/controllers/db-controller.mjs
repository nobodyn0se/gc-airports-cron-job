import axios from 'axios';

import logger from "../middleware/logger.mjs";
import {parseCsvData} from "../util/parse-csv-data.mjs";
import {processAirportData} from "../util/process-airport-data.mjs";
import tx from "../services/tx.mjs";
import {batchUpsertAirports} from "../services/db.mjs";

const fetchAndUpdateAirports = async () => {
    let csvData;
    let dbClient;

    try {
        logger.info('Fetching airport data from remote server...');
        const response = await axios.get(process.env.CSV_URL);
        csvData = response.data;

        logger.info(
            `CSV data fetched. First 200 characters: ${csvData.substring(0, 200)}`
        );

        const results = await parseCsvData(csvData);

        const processedAirports = processAirportData(results);
        logger.info(
            `Processed ${processedAirports.length} where IATA, ICAO, lat, long are all present`
        );

        if (processedAirports.length > 0) {
            // await createAirportsTable();
            const BATCH_SIZE = parseInt(process.env.BATCH_SIZE);

            dbClient = await tx.startTx();

            for (let i = 0; i < processedAirports.length; i += BATCH_SIZE) {
                const batch = processedAirports.slice(i, i + BATCH_SIZE);
                await batchUpsertAirports(dbClient, batch);
            }

            await tx.commitTx(dbClient);

            logger.info(
                `Upserted ${processedAirports.length} valid airports into Postgres DB`
            );
        } else {
            logger.info('No airports to update/insert today');
        }
    } catch (error) {
        logger.error(error);

        if (dbClient) {
            await tx.rollbackTx(dbClient);
        }
    } finally {
        if (dbClient) {
            await tx.endPool();
        }
    }
};

export {fetchAndUpdateAirports};