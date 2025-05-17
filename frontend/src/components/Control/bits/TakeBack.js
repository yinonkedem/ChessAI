import { useAppContext }from '../../../contexts/Context'
import { takeBack } from '../../../reducer/actions/move';
import { Status } from '../../../constants'

const TakeBack = () => {

    const { appState: { status }, dispatch } = useAppContext();
    const disabled = status === Status.promoting;

    return <div>
                 <button
                     onClick={() => dispatch(takeBack())}
                     disabled={disabled}
                     className={disabled ? 'btn--disabled' : ''}
                 >
                     Take Back
                 </button>
    </div>
}

export default TakeBack