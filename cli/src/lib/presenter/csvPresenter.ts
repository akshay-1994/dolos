import { Presenter } from "./presenter";
import csvStringify from "csv-stringify";
import { Writable } from "stream";
import { createWriteStream, promises as fs } from "fs";

export function writeCSVto<T>(
  out: Writable,
  data: T[],
  extractor: {[field: string]: (obj: T) => string | number | null}
): void {

  const csv = csvStringify();
  csv.pipe(out);

  const keys: string[] = [];
  const extractors: Array<(obj: T) => string | number | null> = [];
  for (const [key, extract] of Object.entries(extractor)) {
    keys.push(key);
    extractors.push(extract);
  }

  csv.write(keys);
  for(const datum of data) {
    csv.write(extractors.map(e => e(datum)));
  }
  csv.end();
}

export class CsvPresenter extends Presenter {

  public writeDiffs(out: Writable): void {
    writeCSVto(
      out,
      this.report.scoredDiffs,
      {
        "id": s => s.diff.id,
        "leftFileId": s => s.diff.leftFile.id,
        "rightFileId": s => s.diff.rightFile.id,
        "similarity": s => s.similarity,
        "totalOverlap": s => s.overlap,
        "continuousOverlap": s => s.longest,
        "blocks": s => JSON.stringify(s.diff.blocks().map(
          block => { return {
            leftSelection: block.leftSelection,
            rightSelection: block.rightSelection,
            data: block.mergedData,
            pairedOccurrences: block.pairs.map(pair => { return {
              sharedKmer: pair.kmer.id,
              left: {
                start: pair.left.start,
                stop: pair.left.stop,
                index: pair.left.index,
              },
              right: {
                start: pair.right.start,
                stop: pair.right.stop,
                index: pair.right.index,
              }
            };})
          };}))
      });
  }

  public writeKmers(out: Writable): void {
    writeCSVto(
      out,
      this.report.sharedKmers(),
      {
        "id": s => s.id,
        "hash": s => s.hash,
        "data": s => s.kmer,
        "files": s => JSON.stringify(s.files().map(f => f.id))
      });
  }

  public writeFiles(out: Writable): void {
    writeCSVto(
      out,
      this.report.files(),
      {
        "id": f => f.id,
        "path": f => f.path,
        "content": f => f.content,
        "ast": f => f.ast
      });
  }

  public writeMetadata(out: Writable): void {
    const metaData = this.report.options.asObject();
    writeCSVto(
      out,
      Object.entries(metaData),
      {
        "property": ([k, _v]) => k,
        "value": ([_k, v]) => v,
      });
  }

  async present(): Promise<void> {
    const dirName = `dolos-report-${ new Date().toISOString() }`;
    await fs.mkdir(dirName);

    console.log(`Writing results to directory: ${dirName}`);
    this.writeMetadata(createWriteStream(`${dirName}/metadata.csv`));
    console.log("Metadata written.");
    this.writeDiffs(createWriteStream(`${dirName}/diffs.csv`));
    console.log("Diffs written.");
    this.writeKmers(createWriteStream(`${dirName}/kmers.csv`));
    console.log("Kmers written.");
    this.writeFiles(createWriteStream(`${dirName}/files.csv`));
    console.log("Files written.");
    console.log("Completed");
  }

}