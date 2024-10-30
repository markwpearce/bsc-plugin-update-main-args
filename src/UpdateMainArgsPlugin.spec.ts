import { Program, standardizePath as s } from 'brighterscript';
import * as fsExtra from 'fs-extra';
import { UpdateMainArgsConfig, UpdateMainArgsPlugin } from './UpdateMainArgsPlugin';
import undent from 'undent';
import { expect } from 'chai';
import * as dotenv from 'dotenv'


describe('UpdateMainArgsPlugin', () => {
    let program: Program;
    const tempDir = s`${__dirname}/../.tmp`;
    const rootDir = s`${tempDir}/rootDir`;
    const stagingDir = s`${tempDir}/stagingDir`;
    let plugin: UpdateMainArgsPlugin;


    function writeEnvFile(data: Record<string, any>, path = s`${tempDir}/.env`) {
        const json = JSON.stringify(data);
        fsExtra.outputFileSync(path, undent`
            MAIN_ARGS=${json}
        `)
    }

    function setConfig(config: Partial<UpdateMainArgsConfig>) {
        program.options = {
            ...program.options, ...{
                updateMainArgs: {
                    envFilePath: s`${tempDir}/.env`,
                    ...config
                }
            }
        };

        plugin.setNormalizedConfig(program);
    }

    function getTranspiledFileSource(path: string) {
        const buffer = fsExtra.readFileSync(s`${stagingDir}/${path}`);
        return buffer.toString();
    }

    beforeEach(() => {
        plugin = new UpdateMainArgsPlugin()
        fsExtra.emptyDirSync(rootDir);
        fsExtra.emptyDirSync(stagingDir);

        program = new Program({
            rootDir: rootDir,
            stagingDir: stagingDir
        });
        program.plugins.add(plugin);
    });

    afterEach(() => {
        fsExtra.removeSync(tempDir);
        // clean process.env
        dotenv.config();
    });

    describe('config', () => {
        it('gets default correctly', () => {
            const config = plugin.setNormalizedConfig(program);
            expect(config.args).to.deep.eq({});
            expect(config.envFilePath).to.eq('./.env');
            expect(config.envVar).to.eq('MAIN_ARGS');
            expect(config.useEnv).to.eq(false);
        });

        it('reads config', () => {
            program.options = {
                ...program.options, ...{
                    updateMainArgs: {
                        args: { additional: 'args' },
                        envFilePath: './extra',
                        envVar: 'OTHER_KEY',
                        useEnv: true
                    }
                }
            };
            const config = plugin.setNormalizedConfig(program);
            expect(config.args).to.deep.eq({ additional: 'args' });
            expect(config.envFilePath).to.eq('./extra');
            expect(config.envVar).to.eq('OTHER_KEY');
            expect(config.useEnv).to.eq(true);
        });

        it('gets config from bsconfig during build', async () => {
            program.options = {
                ...program.options, ...{
                    updateMainArgs: {
                        args: { additional: 'args' },
                        envFilePath: './extra',
                        envVar: 'OTHER_KEY',
                        useEnv: false
                    }
                }
            };
            await program.build();
            const config = plugin.config
            expect(config.args).to.deep.eq({ additional: 'args' });
            expect(config.envFilePath).to.eq('./extra');
            expect(config.envVar).to.eq('OTHER_KEY');
            expect(config.useEnv).to.eq(false);
        });
    });

    describe('argument loading', () => {
        it('includes args from env', () => {
            setConfig({ useEnv: true });
            writeEnvFile({ arg: "value" });

            const result = plugin.getArgsFromEnv();
            expect(result).to.exist;
            expect(result['arg']).to.equal('value');
        });

        it('includes args from other env file', () => {
            setConfig({ useEnv: true, envFilePath: './.otherenv' });
            writeEnvFile({ arg: "value" }, './.otherenv');

            const result = plugin.getArgsFromEnv();
            expect(result).to.exist;
            expect(result['arg']).to.equal('value');
        });


        it('merges args from bsconfig and env', () => {
            setConfig({ useEnv: true, args: { other: 123 } });
            writeEnvFile({ arg: "value" });

            const result = plugin.getArgsFromEnv();
            expect(result).to.exist;
            expect(result['arg']).to.equal('value');
            expect(result['other']).to.equal(123);
        });
    });

    describe('adding args to main', () => {
        it('includes args from env', async () => {
            setConfig({ useEnv: true });
            writeEnvFile({ arg: "value" });
            program.setFile('source/main.brs', `
                sub main()
                end sub
            `);
            await program.build();
            expect(program.getDiagnostics()).to.be.empty;
            const mainSource = getTranspiledFileSource('source/main.brs');
            expect(mainSource).to.include('args.append(parseJson("{""arg"":""value""}"))')
        });

        it('includes args from bsconfig', async () => {
            setConfig({ useEnv: false, args: { test: 123 } });
            program.setFile('source/main.brs', `
                sub main()
                end sub
            `);
            await program.build();
            const mainSource = getTranspiledFileSource('source/main.brs');
            expect(mainSource).to.include('args.append(parseJson("{""test"":123}"))')
        });

        it('includes merged args from bsconfig and env', async () => {
            setConfig({ useEnv: true, args: { test: 123 } });
            writeEnvFile({ arg: "value" });
            program.setFile('source/main.brs', `
                sub main()
                end sub
            `);
            await program.build();
            expect(program.getDiagnostics()).to.be.empty;
            const mainSource = getTranspiledFileSource('source/main.brs');
            expect(mainSource).to.include('args.append(parseJson("{""test"":123,""arg"":""value""}"))')
        });

        it('updates an existing argument', async () => {
            setConfig({ useEnv: true, args: { test: 123 } });
            writeEnvFile({ arg: "value" });
            program.setFile('source/main.brs', `
                sub main(myArg as object)
                end sub
            `);
            await program.build();
            expect(program.getDiagnostics()).to.be.empty;
            const mainSource = getTranspiledFileSource('source/main.brs');
            expect(mainSource).to.include('myArg.append(parseJson("{""test"":123,""arg"":""value""}"))')
        });

    });

});