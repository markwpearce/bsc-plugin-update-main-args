import { AALiteralExpression, BeforeBuildProgramEvent, CallExpression, CompilerPlugin, createIdentifier, createStringLiteral, createToken, DottedGetExpression, FinalizedBsConfig, FunctionParameterExpression, FunctionStatement, isBrsFile, isFunctionStatement, LiteralExpression, ParseMode, PrepareFileEvent, ProgramBuilder, TokenKind, VariableExpression, type BeforeProgramCreateEvent, type BeforeSerializeFileEvent } from 'brighterscript';
import { Logger } from 'brighterscript/dist/logging';
import * as dotenv from 'dotenv'

export interface UpdateMainArgsConfig {
    /**
     * Path the `.env` to load
     * default: '.env'
     */
    envFilePath: string;
    /**
     * Arguments to be appended to the Main() args
     * default: {}
     */
    args: Record<string, any>;
    /**
     * The environment variable to read
     * default: 'MAIN_ARGS'
     */
    envVar: string;
    /**
     * Read environment variable
     * default: false
     */
    useEnv: boolean;
}

export const CONFIG_KEY = 'updateMainArgs';

export const LOG_PREFIX = '[UpdateMainArgsPlugin]'

export class UpdateMainArgsPlugin implements CompilerPlugin {
    name = 'bsc-plugin-update-main-args';

    config: UpdateMainArgsConfig;
    logger: Logger;

    /**
     * Read Program options and set config
     * @param event
     */
    public beforeBuildProgram(event: BeforeBuildProgramEvent) {
        const programBuilder = event.program;
        this.setNormalizedConfig(programBuilder)
        this.logger = programBuilder.logger;
    }

    /**
     * If file is in the source scope and has the main() function, update its args
     * @param event
     * @returns
     */
    public beforePrepareFile(event: PrepareFileEvent) {
        if (!this.config) {
            return;
        }
        if (event.program.getScopeByName('source') !== event.scope) {
            return;
        }
        if (!isBrsFile(event.file)) {
            return;
        }
        const argsToAppend = this.getArgsFromEnv();
        if (Object.keys(argsToAppend).length === 0) {
            return;
        }
        const mainFunction = event.file.ast.statements.find((stmt) => {
            return isFunctionStatement(stmt) && stmt.getName(ParseMode.BrightScript).toLowerCase() === 'main';
        }) as FunctionStatement;
        if (!mainFunction) {
            return;
        }
        this.logger?.info(LOG_PREFIX, 'Updating main() args with:', argsToAppend)

        if (mainFunction.func.parameters.length === 0) {
            mainFunction.func.parameters.push(new FunctionParameterExpression({
                name: createIdentifier('args'),
                defaultValue: new AALiteralExpression({ elements: [] })
            }));
        }
        const firstParam = mainFunction.func.parameters[0];
        const argsVar = new VariableExpression({ name: firstParam.tokens.name });
        const argsAppendExpr = new DottedGetExpression({
            obj: argsVar,
            name: createIdentifier('append')
        })
        const parseJSONCall = new CallExpression({
            callee: new VariableExpression({ name: createIdentifier('parseJson') }),
            args: [
                createStringLiteral(JSON.stringify(argsToAppend).replaceAll('"', '""'))
            ],
            openingParen: createToken(TokenKind.LeftParen),
            closingParen: createToken(TokenKind.RightParen)
        })

        const argsAppendCall = new CallExpression({
            callee: argsAppendExpr,
            args: [
                parseJSONCall
            ],
            openingParen: createToken(TokenKind.LeftParen),
            closingParen: createToken(TokenKind.RightParen)
        });

        event.editor.arrayUnshift(mainFunction.func.body.statements, argsAppendCall);
    }

    /**
     * Normalize the configuration
     * @param program
     * @returns
     */
    public setNormalizedConfig(program: { options: FinalizedBsConfig }): UpdateMainArgsConfig {
        const bscOptions = program.options[CONFIG_KEY];
        const config: UpdateMainArgsConfig = {
            envFilePath: bscOptions?.envFilePath ?? './.env',
            envVar: bscOptions?.envVar ?? 'MAIN_ARGS',
            args: bscOptions?.args ?? {},
            useEnv: bscOptions?.useEnv ?? false
        }
        this.config = config;
        return this.config;
    }

    /**
     * Merge the args to be be added from the ENV file and from the options
     * @returns
     */
    public getArgsFromEnv(): Record<string, any> {
        let result = this.config.args;
        if (!this.config.useEnv) {
            this.logger.debug(LOG_PREFIX, 'Not loading environment variable')
            return result;
        }
        const parseResult = dotenv.config({ path: this.config.envFilePath })

        if (parseResult.parsed || process.env[this.config.envVar]) {
            if (process.env[this.config.envVar]) {
                let envValue = process.env[this.config.envVar];
                let jsonResult = JSON.parse(envValue ?? "{}");
                if (typeof jsonResult === 'object' && jsonResult) {
                    this.logger?.debug(LOG_PREFIX, 'Valid ENV data')

                    result = { ...result, ...jsonResult }

                } else {
                    this.logger?.error(LOG_PREFIX, `${this.config.envVar} should be parsable as a JSON object, but found "${envValue}"`);
                }
            } else {
                this.logger?.error(LOG_PREFIX, `Cannot find environment variable "${this.config.envVar}" in env file: ${this.config.envFilePath}`);
            }
        } else {
            this.logger?.error(LOG_PREFIX, `Cannot find environment variable "${this.config.envVar}"`);
        }

        return result;
    }
}

