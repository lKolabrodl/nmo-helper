import {installPageStateReceiver} from './patch/subscribePageState';
import {unlockPageInteractions} from './patch/unlockPageInteractions';

installPageStateReceiver();
unlockPageInteractions();
