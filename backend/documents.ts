import { extractText, getDocumentProxy } from 'unpdf';
import { HttpError } from './validation.ts';
export async function extractDocument(bytes: Uint8Array, name: string) {
  if (/\.txt$/i.test(name)) {
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new HttpError(422, 'Text files must use UTF-8 encoding.');
    }
    if (text.includes('\0'))
      throw new HttpError(422, 'This is not a plain text file.');
    return validate(text, 1);
  }
  if (
    !/\.pdf$/i.test(name) ||
    new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-'
  )
    throw new HttpError(415, 'Upload a valid PDF or UTF-8 TXT file.');
  try {
    const pdf = await getDocumentProxy(bytes, {maxImageSize: 16777216});
    try {
      if (pdf.numPages > 150)
        throw new HttpError(422, 'PDFs are limited to 150 pages.');
      const result = await extractText(pdf, { mergePages: false });
      return validate(
        result.text.map((s, i) => '[Page ' + (i + 1) + ']\n' + s).join('\n\n'),
        result.totalPages,
      );
    } finally {
      await pdf.loadingTask.destroy();
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(
      422,
      'Could not read this PDF. Remove encryption or upload a text export.',
    );
  }
}
function validate(text: string, pages: number) {
  if (text.replace(/\[Page \d+\]/g, '').trim().length < 15)
    throw new HttpError(
      422,
      'No readable text found. Scanned PDFs need OCR before upload.',
    );
  if (text.length > 150_000)
    throw new HttpError(
      422,
      'Extracted text exceeds 150,000 characters; split the document.',
    );
  return { text, pages };
}
