const os = require('os')
const path = require('path')

const homeDir = os.homedir();
const operatingSystem = os.type();
const network = 'mainnet';

const paths = {
    Darwin: {
        cert: path.join(homeDir, 'Library', 'Application Support', 'Lnd', 'tls.cert'),
        macaroon: path.join(homeDir, 'Library', 'Application Support', 'Lnd', 'data', 'chain', 'bitcoin', network, 'admin.macaroon'),
    },
    Linux: {
        cert: path.join(homeDir, '.lnd', 'tls.cert'),
        macaroon: path.join(homeDir, '.lnd', 'data', 'chain', 'bitcoin', network, 'admin.macaroon'),
    },
    Windows_NT: {
        cert: path.join(homeDir, 'AppData', 'Local', 'Lnd', 'tls.cert'),
        macaroon: path.join(homeDir, 'AppData', 'Local', 'Lnd', 'data', 'chain', 'bitcoin', network, 'admin.macaroon'),
    }
}

let pathsForOS;
if (operatingSystem in paths) {
    pathsForOS = paths[operatingSystem];
} else {
    console.log(`Unable to detect operating system: ${operatingSystem}\n Defaulting to Linux paths, but may need to be changed when prompted.`);
    pathsForOS = paths.Linux;
}

export const CERT = '/Users/dz/.polar/networks/1/volumes/lnd/alice/tls.cert';
export const MACAROON = '/Users/dz/.polar/networks/1/volumes/lnd/alice/data/chain/bitcoin/regtest/admin.macaroon'
export const SOCKET = '127.0.0.1:10001';
export const SUPPORTED_METHODS = ['bolt11', 'p2wpkh', 'p2sh', 'p2pkh'];
export const URL_PREFIX = 'slashpay:';
