import classNames from 'classnames/bind';
import { useTranslation } from 'react-i18next';
import React, { memo, useCallback, useContext, useState } from 'react';
import { Button, TextArea } from 'shared/uiKit';
import { ChatAddAttachment, ChatSendMessage } from 'shared/assets/icons/chats';
import { chatConnectionErrorSelector, sendMessage } from 'entities/Chat/ChatDialog/model/selectors';
import { useDispatch } from 'react-redux';
import { useAppSelector } from 'shared/model/hooks/reduxAppHooks';
import { setServiceRequestModalState } from 'entities/ServiceRequest';
import { DisplayContext } from 'shared/lib/dispalyContext/displayLayoutContext';
import { useKeyDownHandler } from 'shared/model/hooks/useKeyDownHandler';
import { FileRejection, useDropzone } from 'react-dropzone';
import { handleSelectedFiles, IProcessLoadFile, LoadStatus } from 'entities/Chat/ChatDialog/ui/ChatFileLoadModal/fileLoadUtils';
import { ChatFileLoadModal } from 'entities/Chat/ChatDialog/ui/ChatFileLoadModal/ChatFileLoadModal';
import { AttachmentType } from 'entities/Chat/ChatDialog/model/types';
import { INPUT_TEXT_MAX_LENGTH } from '../../lib/utils';
import styles from './chatFooter.module.scss';

const cx = classNames.bind(styles);

interface IChatFooter {
  chatClosed: boolean
  requestId?: number
  showConfirmBlock: boolean
}

const MAX_FILES_LIMIT = 10;

export const ChatFooter = memo(({ chatClosed, requestId, showConfirmBlock } : IChatFooter) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { smartDevice: smart } = useContext(DisplayContext);
  const connectionErr = useAppSelector(chatConnectionErrorSelector);

  const [messageText, setMessageText] = useState('');

  /** загрузка файлов --->  */
  const [loadingFiles, setLoadingFiles] = useState<IProcessLoadFile[]>([]);
  const loadFilesLength = loadingFiles.length;
  const remainingFileLimit = MAX_FILES_LIMIT - loadFilesLength;

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[]) => {
    handleSelectedFiles(acceptedFiles, fileRejections, remainingFileLimit, setLoadingFiles);
  }, []);

  const { getRootProps, getInputProps } = useDropzone({ onDrop, maxFiles: remainingFileLimit });

  const closeLoadFilesModal = () => {
    /** перед закрытием модалки проверяем наличие текущих загрузкок - останавливаем их при наличии */
    loadingFiles.forEach((el) => {
      if (el.status === LoadStatus.pending) el.controller.abort('User cansel request');
    });
    setLoadingFiles([]);
  };
  /** <--- загрузка файлов */

  const onMessageSend = (files?: AttachmentType[]) => {
    if (!!messageText?.trim()?.length || files?.length) {
      dispatch(sendMessage({ text: messageText || '', attachments: files || null }));
      setMessageText('');
      setLoadingFiles([]);
    }
  };

  useKeyDownHandler({ cb: onMessageSend, dependency: messageText, condition: !smart });

  /** приемка работы по заявке из чата --->  */
  const confirmServiceRequest = () => {
    dispatch(setServiceRequestModalState({ modalKey: 'closed', isOpen: true, id: requestId }));
  };
  /** <--- приемка работы по заявке из чата */

  if (chatClosed) return null;
  return (
    <div>
      {showConfirmBlock && (
        <div className={cx('confirmBlock')}>
          <p className={cx('confirmText')}>{t('Chats.Accept_tasks')}</p>
          <Button scale="s" onClick={confirmServiceRequest} className={cx('confirmBtn')}>
            {t('Chats.Confirm')}
          </Button>
        </div>
      )}
      <div className={cx('chatFooterWrapper')}>
        <div {...getRootProps({ className: cx('actionBtn', ['right']) })}>
          <input {...getInputProps()} />
          <ChatAddAttachment />
        </div>
        <div className={cx('textAreaWrapper')}>
          <TextArea
            minRows={1}
            maxRows={8}
            bordered={false}
            grayColor={!smart}
            style={{ fontSize: 14 }}
            onChange={setMessageText}
            className={cx('textArea')}
            maxLength={INPUT_TEXT_MAX_LENGTH}
            placeholder={t('Chats.Type_placeholder')}
            value={loadFilesLength ? '' : messageText}
          />
        </div>
        <div
          onClick={() => onMessageSend()}
          className={cx('actionBtn', ['left'], { disable: connectionErr })}
        >
          <ChatSendMessage />
        </div>

        {connectionErr && (
        <div className={cx('connectionErr')}>
          {t('Chats.Waiting_connection')}
        </div>
        )}
      </div>

      <ChatFileLoadModal
        files={loadingFiles}
        open={!!loadFilesLength}
        messageText={messageText}
        setMessageText={setMessageText}
        onMessageSend={onMessageSend}
        setLoadingFiles={setLoadingFiles}
        remainingFileLimit={remainingFileLimit}
        onCancel={closeLoadFilesModal}
      />
    </div>
  );
});
