const path = require('path');

describe('upload-tenant script', () => {
  let parseArgs;
  let uploadTenant;
  let projectConstructor;
  let upload;
  let spawnSync;
  let fsMock;
  let consoleMock;
  let order;

  beforeEach(() => {
    jest.resetModules();

    order = [];
    projectConstructor = jest.fn(config => {
      order.push('project');
      return { config };
    });
    upload = jest.fn().mockImplementation(() => {
      order.push('upload');
      return Promise.resolve({ ok: true });
    });
    spawnSync = jest.fn().mockImplementation((execPath, args) => {
      order.push(String(args[0]).includes('sync-tenant-config.js') ? 'sync' : 'apply');
      return { status: 0 };
    });
    fsMock = {
      existsSync: jest.fn(filePath =>
        filePath.endsWith(path.join('config', 'tenants', 'chaoren.js')) ||
        filePath.endsWith(path.join('keys', 'chaoren.key.pem'))
      )
    };
    consoleMock = {
      log: jest.fn(),
      error: jest.fn()
    };

    ({ parseArgs, uploadTenant } = require('../../scripts/upload-tenant'));
  });

  test('parses --sync before or after slug', () => {
    expect(parseArgs(['node', 'script', '--sync', 'fanren'])).toEqual({
      slug: 'fanren',
      options: {
        sync: true,
        version: undefined,
        desc: undefined
      }
    });
    expect(parseArgs(['node', 'script', 'fanren', '1.2.3', 'desc', '--sync', '--file', 'tenant.json'])).toEqual({
      slug: 'fanren',
      options: {
        sync: true,
        file: 'tenant.json',
        version: '1.2.3',
        desc: 'desc'
      }
    });
  });

  test('applies tenant config before creating the CI project and uploading', async () => {
    const tenant = require('../../config/tenants/chaoren');

    await uploadTenant('chaoren', {
      fs: fsMock,
      spawnSync,
      ci: {
        Project: projectConstructor,
        upload
      },
      console: consoleMock,
      execPath: '/usr/local/bin/node',
      version: '1.2.3',
      desc: 'tenant upload test'
    });

    expect(order).toEqual(['apply', 'project', 'upload']);
    expect(spawnSync).toHaveBeenCalledWith(
      '/usr/local/bin/node',
      [expect.stringContaining(path.join('scripts', 'apply-tenant.js')), 'chaoren'],
      { stdio: 'inherit' }
    );
    expect(projectConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        appid: tenant.wxAppId,
        privateKeyPath: expect.stringContaining(path.join('keys', 'chaoren.key.pem'))
      })
    );
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({
        version: '1.2.3',
        desc: 'tenant upload test'
      })
    );
  });

  test('does not upload when apply-tenant fails', async () => {
    spawnSync.mockImplementationOnce(() => {
      order.push('apply');
      return { status: 9 };
    });

    await expect(uploadTenant('chaoren', {
      fs: fsMock,
      spawnSync,
      ci: {
        Project: projectConstructor,
        upload
      },
      console: consoleMock,
      execPath: '/usr/local/bin/node',
      version: '1.2.3',
      desc: 'tenant upload test'
    })).rejects.toMatchObject({
      isCliError: true,
      exitCode: 9
    });

    expect(order).toEqual(['apply']);
    expect(projectConstructor).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  test('syncs tenant config before applying and uploading when --sync is enabled', async () => {
    await uploadTenant('chaoren', {
      sync: true,
      file: 'tenant.json',
      fs: fsMock,
      spawnSync,
      ci: {
        Project: projectConstructor,
        upload
      },
      console: consoleMock,
      execPath: '/usr/local/bin/node',
      version: '1.2.3',
      desc: 'tenant upload test'
    });

    expect(order).toEqual(['sync', 'apply', 'project', 'upload']);
    expect(spawnSync).toHaveBeenNthCalledWith(
      1,
      '/usr/local/bin/node',
      [expect.stringContaining(path.join('scripts', 'sync-tenant-config.js')), 'chaoren', '--file', 'tenant.json'],
      { stdio: 'inherit' }
    );
    expect(spawnSync).toHaveBeenNthCalledWith(
      2,
      '/usr/local/bin/node',
      [expect.stringContaining(path.join('scripts', 'apply-tenant.js')), 'chaoren'],
      { stdio: 'inherit' }
    );
  });

  test('allows sync to create a missing tenant config before existence check', async () => {
    const realExistsSync = fsMock.existsSync;
    fsMock.existsSync = jest.fn(filePath => {
      if (filePath.endsWith(path.join('config', 'tenants', 'chaoren.js'))) {
        return spawnSync.mock.calls.some(call => String(call[1][0]).includes('sync-tenant-config.js'));
      }
      return realExistsSync(filePath);
    });

    await uploadTenant('chaoren', {
      sync: true,
      file: 'tenant.json',
      fs: fsMock,
      spawnSync,
      ci: {
        Project: projectConstructor,
        upload
      },
      console: consoleMock,
      execPath: '/usr/local/bin/node',
      version: '1.2.3',
      desc: 'tenant upload test'
    });

    expect(order).toEqual(['sync', 'apply', 'project', 'upload']);
  });
});
