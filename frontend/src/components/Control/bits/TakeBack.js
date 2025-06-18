import { useAppContext } from "../../../contexts/Context";
import { takeBack }      from "../../../reducer/actions/move";
import { Status }        from "../../../constants";

const TakeBack = () => {
    /* pull `position` so we can tell if there’s anything to undo */
    const {
        appState: { status, position },
        dispatch
    } = useAppContext();

    /* disable while promoting **or** when history has just one entry */
    const disabled = status === Status.promoting || position.length <= 1;

    return (
        <button
            onClick={() => !disabled && dispatch(takeBack())}
            disabled={disabled}
            className={disabled ? "btn--disabled" : ""}
        >
            Take&nbsp;Back
        </button>
    );
};

export default TakeBack;
