import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

const SECTION_PATTERNS = [
  { type: 'school_notes', test: /(school|college|university|program|校园|学校|院校|项目|专业|课程|professor|faculty)/i },
  { type: 'parent_notes', test: /(parent|guardian|家长|父母|妈妈|爸爸|建议|备注)/i },
  { type: 'activity_list', test: /(activity|activities|club|社团|活动|志愿|community|service|leadership)/i },
  { type: 'resume', test: /(resume|cv|curriculum vitae|经历|奖项|awards|honors|competition|project|projects|课程|internship)/i }
];

function classifySection(text) {
  const target = String(text || '').slice(0, 240);
  for (const pattern of SECTION_PATTERNS) {
    if (pattern.test.test(target)) {
      return pattern.type;
    }
  }
  return 'other';
}

export async function parseDocx(filePath) {
  const loader = new DocxLoader(filePath);
  const docs = await loader.load();
  const content = docs
    .map((doc) => String(doc.pageContent || '').trim())
    .filter(Boolean)
    .join('\n\n');

  if (!content.trim()) {
    throw new Error('Word 文件解析成功，但未提取到文本内容');
  }

  return { docs, content };
}

export function segmentIntoSections(text) {
  const blocks = String(text || '')
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  return blocks.map((content, index) => ({
    id: `section-${index + 1}`,
    index,
    type: classifySection(content),
    content
  }));
}

export async function buildChunksFromSections(sections) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1400,
    chunkOverlap: 180,
    separators: ['\n\n', '\n', '。', '.', ' ']
  });

  const rawChunks = [];
  for (const section of sections) {
    const documents = await splitter.createDocuments([section.content], [
      {
        sectionId: section.id,
        sectionType: section.type
      }
    ]);
    documents.forEach((document, index) => {
      rawChunks.push({
        section_id: section.id,
        section_type: section.type,
        chunk_index: index,
        content: document.pageContent
      });
    });
  }

  const chunks = [];
  let buffer = [];
  let bufferLength = 0;

  function flushBuffer() {
    if (buffer.length === 0) {
      return;
    }

    const sectionIds = [...new Set(buffer.map((item) => item.section_id))];
    const sectionTypes = [...new Set(buffer.map((item) => item.section_type))];
    chunks.push({
      section_id: sectionIds.join(','),
      section_type: sectionTypes.join(','),
      chunk_index: chunks.length,
      content: buffer.map((item) => item.content).join('\n\n')
    });
    buffer = [];
    bufferLength = 0;
  }

  for (const chunk of rawChunks) {
    const nextLength = bufferLength + chunk.content.length;
    if (buffer.length > 0 && nextLength > 2600) {
      flushBuffer();
    }

    buffer.push(chunk);
    bufferLength += chunk.content.length;

    if (bufferLength >= 1800) {
      flushBuffer();
    }
  }

  flushBuffer();

  return chunks;
}
