import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function getComposeServiceBlock(composeText, serviceName) {
  const lines = composeText.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `  ${serviceName}:`);

  assert.ok(start >= 0, `expected compose service block for ${serviceName}`);

  const block = [lines[start]];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[^\s#][^:]*:\s*(?:.*)?$/.test(line)) {
      break;
    }
    block.push(line);
  }

  return block.join('\n');
}

test('docker compose adds pgadmin while keeping postgres private', () => {
  const compose = read('docker-compose.yml');
  const postgresBlock = getComposeServiceBlock(compose, 'postgres');
  const pgadminBlock = getComposeServiceBlock(compose, 'pgadmin');

  assert.doesNotMatch(postgresBlock, /^\s+ports:\s*$/m);
  assert.match(pgadminBlock, /image: \$\{PGADMIN_IMAGE:-dpage\/pgadmin4:/);
  assert.match(pgadminBlock, /SCRIPT_NAME: \/pgadmin/);
  assert.match(pgadminBlock, /PGADMIN_DEFAULT_EMAIL: \$\{PGADMIN_DEFAULT_EMAIL:-/);
  assert.match(pgadminBlock, /depends_on:\s*\n\s+postgres:/);
});

test('nginx proxies pgadmin on a subpath', () => {
  const nginx = read('docker/nginx/default.conf');

  assert.match(nginx, /location = \/pgadmin/);
  assert.match(nginx, /location \/pgadmin\//);
  assert.match(nginx, /proxy_pass http:\/\/pgadmin:80\//);
  assert.match(nginx, /proxy_set_header X-Script-Name \/pgadmin/);
});

test('example environment documents pgadmin and configurable postgres credentials', () => {
  const envExample = read('.env.example');

  assert.match(envExample, /^PGADMIN_IMAGE=dpage\/pgadmin4:/m);
  assert.match(envExample, /^PGADMIN_DEFAULT_EMAIL=/m);
  assert.match(envExample, /^PGADMIN_DEFAULT_PASSWORD=/m);
  assert.match(envExample, /^POSTGRES_DB=/m);
  assert.match(envExample, /^POSTGRES_USER=/m);
  assert.match(envExample, /^POSTGRES_PASSWORD=/m);
});

test('readme documents the pgadmin URL and security guidance', () => {
  const readme = read('README.md');

  assert.match(readme, /\/pgadmin\//);
  assert.match(readme, /(安全组|security group|IP白名单|IP allowlist|访问控制|访问限制)/i);
  assert.match(readme, /5432/);
  assert.match(readme, /(不要|不建议|避免|do not|don't|avoid).{0,20}(开放|暴露|expose|publish|public)/i);
});

test('github actions deployment provisions postgres and pgadmin environment variables', () => {
  const workflow = read('.github/workflows/deploy-aliyun.yml');

  assert.match(workflow, /POSTGRES_DB:/);
  assert.match(workflow, /POSTGRES_USER:/);
  assert.match(workflow, /POSTGRES_PASSWORD:/);
  assert.match(workflow, /PGADMIN_DEFAULT_EMAIL:/);
  assert.match(workflow, /PGADMIN_DEFAULT_PASSWORD:/);
  assert.match(workflow, /envs: .*POSTGRES_DB,POSTGRES_USER,POSTGRES_PASSWORD,PGADMIN_DEFAULT_EMAIL,PGADMIN_DEFAULT_PASSWORD/);
  assert.match(workflow, /POSTGRES_DB=\$\{POSTGRES_DB:-loveessay\}/);
  assert.match(workflow, /POSTGRES_USER=\$\{POSTGRES_USER:-loveessay\}/);
  assert.match(workflow, /POSTGRES_PASSWORD=\$\{POSTGRES_PASSWORD:-loveessay\}/);
  assert.match(workflow, /PGADMIN_DEFAULT_EMAIL=\$\{PGADMIN_DEFAULT_EMAIL:-admin@example.com\}/);
  assert.match(workflow, /缺少 pgAdmin 登录密码配置: PGADMIN_DEFAULT_PASSWORD/);
  assert.doesNotMatch(workflow, /PGADMIN_DEFAULT_PASSWORD=\$\{PGADMIN_DEFAULT_PASSWORD:-change-pgadmin-password\}/);
  assert.match(workflow, /检测到现有 pgdata/);
});
