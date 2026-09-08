import fs from 'fs';

const proxyPath = 'server/_core/storageProxy.ts';
let proxyContent = fs.readFileSync(proxyPath, 'utf8');

proxyContent = proxyContent.replace(`import { auditMutation } from "../db";`, `import { auditMutation } from "../routers/_shared";`);

fs.writeFileSync(proxyPath, proxyContent);
