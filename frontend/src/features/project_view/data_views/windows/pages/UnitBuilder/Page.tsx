import ContentBlock from '../../../_components/ContentBlock';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import LoadingModal from '../../../_components/LoadingModal';

const WindowUnits: React.FC = () => {
    return (
        <ContentBlock>
            <LoadingModal showModal={false} />
            <ContentBlockHeader text="Window & Door Builder" />
        </ContentBlock>
    );
};

export default WindowUnits;
