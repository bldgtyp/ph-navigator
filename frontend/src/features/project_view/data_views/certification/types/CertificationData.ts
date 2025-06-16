export interface CertificationDataType {
    BLDGTYP_PROJECT_NUMBER: string | undefined;
    PHIUS_PROJECT_NUMBER: string | undefined;
    PROJECT_NAME: string | undefined;
}

export const defaultCertificationData = {
    BLDGTYP_PROJECT_NUMBER: '',
    PHIUS_PROJECT_NUMBER: '',
    PROJECT_NAME: '',
    PROJECT_TYPE: '',
};
