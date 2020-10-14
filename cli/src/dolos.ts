import { Index } from "./lib/analyze";
import { Report } from "./lib/analyze/report";
import { CustomOptions, Options } from "./lib/util/options";
import { CodeTokenizer } from "./lib/tokenizer/codeTokenizer";
import { DodonaInfo, File } from "./lib/file/file";
import { Result } from "./lib/util/result";
import { info, warning, error } from "./lib/util/utils";
import { csvParse } from "d3-dsv";
import * as path from "path";
import { default as fsWithCallbacks } from "fs";
const fs = fsWithCallbacks.promises;

export class Dolos {

  readonly options: Options;
  private readonly tokenizer: CodeTokenizer;
  private readonly index: Index;

  constructor(customOptions?: CustomOptions) {
    this.options = new Options(customOptions);
    this.tokenizer = new CodeTokenizer(this.options.language);
    this.index = new Index(this.tokenizer, this.options);
  }

  public async analyzePaths(paths: string[]): Promise<Report> {
    info("=== Starting report ===");
    let files = null;
    if(paths.length == 1) {
      const infoPath = paths[0];
      if(infoPath.toLowerCase().endsWith(".csv")) {
        info("Reading info-file from Dodona");
        const dirname = path.dirname(infoPath);
        try {
          files = csvParse((await fs.readFile(infoPath)).toString())
            .map((row:  d3.DSVRowString) => ({
              filename: row.filename as string,
              fullName: row.full_name as string,
              id: row.id as string,
              status: row.status as string,
              submissionID: row.submission_id as string,
              nameEN: row.name_en as string,
              nameNL: row.name_nl as string,
              exerciseID: row.exercise_id as string,
              createdAt: new Date(row.created_at as string),
              labels: row.labels as string
            }))
            .map((row: DodonaInfo) => File.fromPath(path.join(dirname, row.filename), row));
        } catch(e) {
          error(e);
          throw new Error("The given '.csv'-file could not be opened");
        }
      } else {
        warning("You only gave one file wich is not a '.csv.'-file. ");
      }
    }
    if(files === null) {
      info(`Reading ${ paths.length} files`);
      files = paths.map(location => File.fromPath(location));
    }
    return this.analyze((await Result.all(files)).ok());
  }

  public async analyze(
    files: Array<File>
  ): Promise<Report> {

    if (files.length < 2) {
      throw new Error("You need to supply at least two files");
    } else if (files.length == 2 && this.options.maxHashPercentage !== null) {
      throw new Error("You have given a maximum hash percentage but your are " +
                      "comparing two files. Each matching hash will thus " +
                      "be present in 100% of the files. This option does only" +
                      "make sense when comparing more than two files.");
    }
    return this.index.compareFiles(files);
  }

}
