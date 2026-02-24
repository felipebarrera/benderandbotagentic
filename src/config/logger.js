import winston from 'winston';

const { combine, timestamp, printf, metadata, errors, json, colorize } = winston.format;

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        errors({ stack: true }),
        timestamp(),
        metadata(),
        json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: combine(
            colorize(),
            timestamp(),
            printf(info => {
                let meta = '';
                if (info.metadata && Object.keys(info.metadata).length > 0) {
                    meta = JSON.stringify(info.metadata);
                }
                return `${info.timestamp} ${info.level}: ${info.message} ${meta}`;
            })
        )
    }));
}

export default logger;
