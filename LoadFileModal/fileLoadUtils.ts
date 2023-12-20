import { ILoadFile } from 'shared/types/entity.types';
import { S3instance } from 'shared/configs/api/instatce';
import { getResponse } from 'shared/configs/api/getResponse';
import { Dispatch, SetStateAction } from 'react';
import { prepareForLoadFile } from 'shared/lib/handleFiles/prepareForLoadFile';
import { FileRejection } from 'react-dropzone';

/** reject - ошибка в процессе загрузки
    internalReject - наша ошибка, пока только при превышении размера файла в 30мб
 */
export enum LoadStatus {
  pending = 'pending',
  success = 'success',
  reject = 'reject',
  internalReject = 'internalReject'
}
const { pending, internalReject, reject, success } = LoadStatus;

export interface IProcessLoadFile {
  id: string,
  finalUrl: string
  status: LoadStatus
  element: ILoadFile
  controller: AbortController
  signal: AbortSignal
  sizeError: boolean | undefined
}

export const getProcessLoadFile = (preparedFile: ILoadFile): IProcessLoadFile => {
  const controller = new AbortController();
  const status = preparedFile.extra.errorSize ? internalReject : pending;
  return {
    status,
    controller,
    finalUrl: '',
    element: preparedFile,
    signal: controller.signal,
    id: preparedFile.extra.id,
    sizeError: preparedFile.extra.errorSize
  };
};

export const handleSelectedFiles = (
  acceptedFiles: File[],
  fileRejections: FileRejection[],
  remainingFileLimit: number,
  setLoadingFiles: Dispatch<SetStateAction<IProcessLoadFile[]>>
) => {
  /** самый простой способ хэндлить превышение лимита выбранных файлов -
      если лимит превышен все файлы попадают в fileRejections
      оттуда мы достаем необходимой кол-во ( остаток отбрасываем ), приводим к виду acceptedFiles и отдаем дальше */
  const selectedFiles = acceptedFiles?.length
    ? acceptedFiles
    : fileRejections.map((el) => el.file).slice(0, remainingFileLimit);

  /** prepareForLoadFile добавляет необходимые meta данные о файле */
  /** getProcessLoadFile добавляет необходимые meta именно для контроля процесса загрузки файла на S3  */
  selectedFiles?.forEach(async (el) => {
    const preparedFile = await prepareForLoadFile(el);
    const readyForLoadFile = getProcessLoadFile(preparedFile);
    setLoadingFiles((prev) => ([readyForLoadFile, ...prev]));
    /** по ТЗ не грузим файлы больше 30мб - но при этом добавляем их на UI с флагами ошибки,
        для остальных запускаем процесс загрузки   */
    if (!readyForLoadFile.sizeError) {
      loadFileRequest(readyForLoadFile, setLoadingFiles);
    }
  });
};

export const loadFileRequest = async (readyForLoadFile: IProcessLoadFile, cb: Dispatch<SetStateAction<IProcessLoadFile[]>>) => {
  /** со старта все файлы залетают сюда в состоянии "pending" указывающим на проецесс загрузки */

  const { element, signal, id } = readyForLoadFile;
  const handleErrorLoad = () => {
    cb((prev) => prev.map((el) => (
      el.id === id ? { ...el, status: reject } : el)));
  };
  try {
    /** обращаемся на наш Апи за ссылкой и кредами для загрузки файла на S3,
        ошибки этого запроса упадут в последний catch */
    const getUploadUrl = ({ fileType = '', fileExt = '' }) => (
      S3instance.get(`/?file_type=${fileType}&file_extension=${fileExt}`)
    );
    const uploadUrl = await getResponse(getUploadUrl, {
      fileType: element.value_unit, fileExt: element.extra?.extension
    });

    /** в случае успеха и реджекта меняем флаги в исходном массиве по каждому файлу,
     для отрисовки соответствующих экшенов */
    const { image_url: finalUrl, presigned_url } = uploadUrl.data;

    /** signal - для прерывания процесса загрузки по каждому файлу в отдельности
     ( сигнал + controller хранятся в каждом объекте, чтобы удобнее дергать прямо "на месте" ) */
    fetch(presigned_url, { method: 'PUT', body: element.file, signal })
      .then(() => {
        cb((prev) => prev.map((el) => (
          el.id === id ? { ...el, status: success, finalUrl } : el)));
      })
      .catch(() => {
        handleErrorLoad();
      });
  } catch (e) {
    handleErrorLoad();
  }
};

export const prepareForSendFilesToChat = (files: IProcessLoadFile[]) => files.map((loadFile) => {
  const { value_unit, extra } = loadFile.element;
  return {
    filename: extra.name,
    file_url: loadFile.finalUrl,
    additional_info: {
      value_unit,
      ...extra
    }
  };
});
