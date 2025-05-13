import './Popup.css'
import {useAppContext} from "../../contexts/Context";
import {Status} from "../../constant";
import {closePopup} from "../../reducer/actions/popup";
import React from "react";


const Popup = ({children}) => {

    const {appState, dispatch} = useAppContext() // get the app state from the context

    if (appState.status === Status.ongoing) {
        return null
    }

    const onClosePopup = () => {
        dispatch(closePopup())
    }

    return <div className="popup">
        {React.Children.toArray(children).map(child =>React.cloneElement(child, {onClosePopup}))}
    </div>
}
export default Popup