import classNames from 'classnames/bind';
import {
  handleSelectedFiles,
  IProcessLoadFile,
  loadFileRequest,
  LoadStatus,
  prepareForSendFilesToChat
} from 'entities/Chat/ChatDialog/ui/ChatFileLoadModal/fileLoadUtils';
import React, { ChangeEvent, Dispatch, SetStateAction, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { FileRejection, useDropzone } from 'react-dropzone';
import { getDomElementById, getFileShortName } from 'shared/lib/utils';
import { InputBase, Modal, Spinner } from 'shared/uiKit';
import { CrossSvg } from 'shared/assets/icons/forms';
import { INPUT_TEXT_MAX_LENGTH } from 'entities/Chat/ChatDialog/lib/utils';
import { ChatSendMessage, DocumentIcon, Play, ReloadIcon, SmartUploadIcon } from 'shared/assets/icons/chats';
import { getFileSize } from 'shared/lib/constants/entity';
import { TrashIcon } from 'shared/assets/icons/reused';
import { AttachmentType } from 'entities/Chat/ChatDialog/model/types';
import { DisplayContext } from 'shared/lib/dispalyContext/displayLayoutContext';
import styles from './chatFileLoadModal.module.scss';

const cx = classNames.bind(styles);

interface ILoadModal {
  files: IProcessLoadFile[]
  open: boolean
  messageText: string
  setMessageText: Dispatch<SetStateAction<string>>
  onCancel: () => void
  remainingFileLimit: number
  onMessageSend: (files: AttachmentType[]) => void
  setLoadingFiles: Dispatch<SetStateAction<IProcessLoadFile[]>>
}

const { pending, internalReject, reject, success } = LoadStatus;
const errorScrollOptions: ScrollIntoViewOptions = { behavior: 'smooth', block: 'nearest', inline: 'start' };

export const ChatFileLoadModal = ({
  files, open, messageText, setMessageText, onCancel, onMessageSend, setLoadingFiles, remainingFileLimit
}: ILoadModal) => {
  const { t } = useTranslation();
  const { smartDevice: smart, mobile, tablet } = useContext(DisplayContext);

  /** downloadIsComplete - ошибочные файлы также считаются как complete,
   кнопка отправки становится активной с последующей проверкой внутри onSubmit и обработкой файлов с ошибками */
  const downloadIsComplete = files.every((el) => el.status !== pending);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[]) => {
    handleSelectedFiles(acceptedFiles, fileRejections, remainingFileLimit, setLoadingFiles);
  }, [remainingFileLimit]);

  const { getRootProps, getInputProps } = useDropzone({ onDrop, maxFiles: remainingFileLimit });

  const cancelLoad = (file: IProcessLoadFile) => {
    file.controller.abort('User cansel request');
    setLoadingFiles((prev) => prev.filter((el) => el.id !== file.id));
  };

  const deleteLoadedFile = (id: string) => {
    /** удаляем уже загруженный или ошибочный файл */
    setLoadingFiles((prev) => prev.filter((el) => el.id !== id));
  };

  const reLoad = (file: IProcessLoadFile) => {
    setLoadingFiles((prev) => prev.map((el) => (
      el.id === file.id ? { ...el, status: pending } : el
    )));
    loadFileRequest(file, setLoadingFiles);
  };

  const submit = () => {
    const firstErrorFile = files?.find((el) => el.status === internalReject || el.status === reject);
    if (firstErrorFile) {
      const errorElement = getDomElementById(firstErrorFile.id);
      errorElement && errorElement.scrollIntoView(errorScrollOptions);
    } else {
      const filesForSend = prepareForSendFilesToChat(files);
      onMessageSend(filesForSend);
    }
  };

  const changeText = (e: ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);
  };

  if (!files?.length) return null;
  return (
    <Modal
      width={578}
      open={open}
      onCancel={onCancel}
      title={<div className={cx('header')}>{t('Chats.Loading_attachments')}</div>}
      className={cx('chatLoadFilesModal', { tablet, mobile })}
    >

      {!!remainingFileLimit && !smart && (
        <div {...getRootProps({ className: cx('uploadArea') })}>
          <input {...getInputProps()} />
          <DocumentIcon />
          <div className={cx('uploadTextWrapper')}>
            <span className={cx('uploadText')}>Загрузите файл </span>
            <span>или перетащите его в эту область</span>
          </div>
          <span className={cx('description')}>Максимум 10 файлов, вес одного файла не должен превышать 30 Мб</span>
        </div>
      )}

      <div className={cx('fileList')}>
        {files.map((loadFile) => (
          <Item
            key={loadFile.id}
            loadFile={loadFile}
            reLoad={reLoad}
            cancelLoad={cancelLoad}
            deleteLoadedFile={deleteLoadedFile}
          />
        ))}
      </div>

      <div className={cx('modalFooter', { smart })}>

        {smart && (
        <button
          type="button"
          disabled={!remainingFileLimit}
          {...getRootProps({ className: cx('actionBtn', ['right'], { disable: !remainingFileLimit }) })}
        >
          <input {...getInputProps()} />
          <SmartUploadIcon />
        </button>
        )}

        <div className={cx('inputWrapper')}>
          <InputBase
            size="m"
            grayColor={!mobile}
            bordered={false}
            value={messageText}
            style={{ fontSize: 14 }}
            onChange={changeText}
            maxLength={INPUT_TEXT_MAX_LENGTH}
            placeholder={t('Chats.Type_placeholder')}
          />
        </div>

        <button
          type="button"
          disabled={!downloadIsComplete}
          className={cx('actionBtn', ['left'], { disable: !downloadIsComplete })}
          onClick={submit}
        >
          <ChatSendMessage />
        </button>
      </div>

    </Modal>
  );
};

interface ILoadItem {
  loadFile: IProcessLoadFile
  deleteLoadedFile: (id: string) => void
  cancelLoad: (file: IProcessLoadFile) => void
  reLoad: (file: IProcessLoadFile) => void
}

const Item = ({ loadFile, cancelLoad, deleteLoadedFile, reLoad }: ILoadItem) => {
  const { t } = useTranslation();
  const { smartDevice: smart } = useContext(DisplayContext);

  const { id, status, element } = loadFile;
  const elementType = element.value_unit;
  const { name, size } = element.extra;

  const isRejectLoad = status === reject;
  const isInternalReject = status === internalReject;
  const isError = isInternalReject || isRejectLoad;
  const showTrashBtn = isError || status === success;
  const isLoad = status === pending && !isError;
  const fileNameCharLimit = smart ? 17 : 25;

  const isVideo = elementType === 'video';
  const isImage = elementType === 'image';
  const isDocument = elementType === 'document';

  const onReload = () => reLoad(loadFile);
  const onCancel = () => cancelLoad(loadFile);
  const deleteFileWithoutAbort = () => deleteLoadedFile(id);

  return (
    <div id={id} key={id} className={cx('fileItem', { error: isError })}>

      <div className={cx('rowInner')}>
        {isImage && <img alt="" src={element.url} className={cx('preview')} />}
        {isVideo && <div className={cx('videoThumb', ['preview'])}><Play /></div>}
        {isDocument && <div className={cx('docWrapper', ['preview'])}><DocumentIcon /></div>}
        <div>
          <p className={cx('fileName')}>{getFileShortName(name, fileNameCharLimit)}</p>
          <p className={cx('fileSize')}>{getFileSize(size)}</p>
        </div>
      </div>

      <div className={cx('actionBtnWrapper')}>
        {isInternalReject && <p className={cx('errorText')}>{t('Chats.More_then_30')}</p>}
        {isRejectLoad && <p className={cx('errorText')}>{t('Chats.Loading_error')}</p>}
        {isRejectLoad && <div className={cx('actionBtn')} onClick={onReload}><ReloadIcon /></div>}

        {isLoad && <Spinner width={20} height={20} size="s" />}
        {isLoad && <div className={cx('actionBtn')} onClick={onCancel}><CrossSvg /></div>}
        {showTrashBtn && <div className={cx('actionBtn')} onClick={deleteFileWithoutAbort}><TrashIcon /></div>}
      </div>

    </div>
  );
};
