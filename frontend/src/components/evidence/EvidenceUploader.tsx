import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import {
  confirmEvidenceUpload,
  createEvidenceUploadTarget,
  isEvidenceUploadCanceled,
  uploadEvidenceFile,
} from '../../api/evidence';
import { ApiError } from '../../api/client';
import type { EvidenceTypeOption } from '../../constants/evidenceTypes';
import { DEFAULT_MAX_EVIDENCE_FILE_SIZE_BYTES, EVIDENCE_FILE_INPUT_ACCEPT } from '../../constants/evidenceTypes';
import type { EvidenceItem } from '../../types/domain';
import { formatFileSize } from '../../utils/format';
import { validateEvidenceFileClientSide } from '../../utils/evidenceFile';

type QueueItemStatus = 'uploading' | 'confirming' | 'success' | 'error' | 'canceled' | 'rejected';

interface QueueItem {
  id: string;
  file: File;
  evidenceType: string;
  status: QueueItemStatus;
  progress: number;
  errorMessage?: string;
  abortController?: AbortController;
}

interface EvidenceUploaderProps {
  caseId: string;
  evidenceTypeOptions: EvidenceTypeOption[];
  maxSizeBytes?: number;
  onUploaded: (evidence: EvidenceItem) => void;
}

let queueItemSequence = 0;
function nextQueueItemId(): string {
  queueItemSequence += 1;
  return `evidence-upload-${queueItemSequence}`;
}

export function EvidenceUploader({
  caseId,
  evidenceTypeOptions,
  maxSizeBytes = DEFAULT_MAX_EVIDENCE_FILE_SIZE_BYTES,
  onUploaded,
}: EvidenceUploaderProps) {
  const [evidenceType, setEvidenceType] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function updateItem(id: string, patch: Partial<QueueItem>) {
    setQueue((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string) {
    setQueue((current) => current.filter((item) => item.id !== id));
  }

  async function runUpload(id: string, file: File, type: string) {
    const abortController = new AbortController();
    updateItem(id, { status: 'uploading', progress: 0, errorMessage: undefined, abortController });

    try {
      const target = await createEvidenceUploadTarget(caseId, {
        evidenceType: type,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      const uploadResult = await uploadEvidenceFile(target, file, {
        signal: abortController.signal,
        onProgress: (percent) => updateItem(id, { progress: percent }),
      });

      updateItem(id, { status: 'confirming', progress: 100 });

      const evidence = await confirmEvidenceUpload(caseId, {
        evidenceId: target.evidenceId,
        fileHash: uploadResult.fileHash,
      });

      updateItem(id, { status: 'success' });
      onUploaded(evidence);
    } catch (err) {
      if (isEvidenceUploadCanceled(err)) {
        updateItem(id, { status: 'canceled' });
        return;
      }
      const message = err instanceof ApiError ? err.message : 'Upload failed. Check your connection and try again.';
      updateItem(id, { status: 'error', errorMessage: message });
    }
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    if (!evidenceType) {
      setFormError('Select an evidence type before uploading a file.');
      return;
    }
    setFormError(null);

    Array.from(fileList).forEach((file) => {
      const id = nextQueueItemId();
      const validationError = validateEvidenceFileClientSide(file, maxSizeBytes);

      if (validationError) {
        setQueue((current) => [
          ...current,
          { id, file, evidenceType, status: 'rejected', progress: 0, errorMessage: validationError },
        ]);
        return;
      }

      setQueue((current) => [...current, { id, file, evidenceType, status: 'uploading', progress: 0 }]);
      void runUpload(id, file, evidenceType);
    });
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleFiles(event.target.files);
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
    handleFiles(event.dataTransfer.files);
  }

  function handleCancel(item: QueueItem) {
    item.abortController?.abort();
  }

  function handleRetry(item: QueueItem) {
    void runUpload(item.id, item.file, item.evidenceType);
  }

  return (
    <div>
      <div className="mb-3">
        <label htmlFor="evidence-type-select" className="form-label fw-semibold">
          Evidence type
        </label>
        <select
          id="evidence-type-select"
          className="form-select"
          value={evidenceType}
          onChange={(event) => {
            setEvidenceType(event.target.value);
            setFormError(null);
          }}
        >
          <option value="" disabled>
            Select evidence type
          </option>
          {evidenceTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {formError ? (
        <div className="alert alert-danger py-2" role="alert">
          {formError}
        </div>
      ) : null}

      <div
        className={`rx-dropzone${isDragActive ? ' rx-dropzone--active' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Drop evidence files here or choose files"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
      >
        <i className="bi bi-cloud-arrow-up text-primary" style={{ fontSize: '1.75rem' }} aria-hidden="true" />
        <p className="mb-1 fw-semibold">Drag and drop a file, or click to browse</p>
        <p className="text-muted small mb-0">PDF, PNG, JPG, or JPEG up to {formatFileSize(maxSizeBytes)}</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={EVIDENCE_FILE_INPUT_ACCEPT}
          onChange={handleInputChange}
          style={{ display: 'none' }}
          aria-label="Choose evidence file"
        />
      </div>

      {queue.length > 0 ? (
        <ul className="list-unstyled mt-3 mb-0">
          {queue.map((item) => (
            <li key={item.id} className="rx-upload-item">
              <div className="d-flex align-items-start justify-content-between gap-2">
                <div className="flex-grow-1 min-width-0">
                  <p className="mb-1 fw-semibold text-truncate">{item.file.name}</p>
                  <p className="text-muted small mb-1">{formatFileSize(item.file.size)}</p>

                  {item.status === 'uploading' || item.status === 'confirming' ? (
                    <div className="progress" style={{ height: '6px' }} role="progressbar" aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100}>
                      <div className="progress-bar" style={{ width: `${item.status === 'confirming' ? 100 : item.progress}%` }} />
                    </div>
                  ) : null}

                  {item.status === 'confirming' ? <p className="text-muted small mb-0 mt-1">Confirming upload&hellip;</p> : null}
                  {item.status === 'success' ? (
                    <p className="small mb-0 mt-1 text-success">
                      <i className="bi bi-check-circle me-1" aria-hidden="true" />
                      Uploaded
                    </p>
                  ) : null}
                  {item.status === 'canceled' ? <p className="text-muted small mb-0 mt-1">Upload canceled.</p> : null}
                  {item.status === 'error' || item.status === 'rejected' ? (
                    <p className="small mb-0 mt-1 text-danger" role="alert">
                      {item.errorMessage}
                    </p>
                  ) : null}
                </div>

                <div className="d-flex flex-column gap-1 flex-shrink-0">
                  {item.status === 'uploading' ? (
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => handleCancel(item)}>
                      Cancel
                    </button>
                  ) : null}
                  {item.status === 'error' || item.status === 'canceled' ? (
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => handleRetry(item)}>
                      Retry
                    </button>
                  ) : null}
                  {item.status === 'success' || item.status === 'error' || item.status === 'rejected' || item.status === 'canceled' ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Dismiss ${item.file.name}`}
                    >
                      <i className="bi bi-x" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
